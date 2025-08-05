import { Database } from "@db/sqlite";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ContactInfo, PaginatedResult } from "./types.ts";

interface Contact {
  id: number;
  firstName: string | undefined;
  lastName: string | undefined;
  organization: string | undefined;
  fullName: string;
  phoneNumbers: string[];
  emailAddresses: string[];
}

interface ContactRow {
  id: number;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
}

interface PhoneRow {
  ZFULLNUMBER: string | null;
}

interface EmailRow {
  ZADDRESS: string | null;
}

/**
 * Open all available AddressBook databases and return database objects
 */
export function openContactsDatabases(): Database[] {
  const databases: Database[] = [];
  const addressBookBasePath = join(
    homedir(),
    "Library",
    "Application Support",
    "AddressBook",
    "Sources",
  );

  try {
    // Find all AddressBook database files
    const sourcesDirs = [];
    for (const entry of Deno.readDirSync(addressBookBasePath)) {
      if (entry.isDirectory) {
        sourcesDirs.push(entry.name);
      }
    }

    // Open each AddressBook database
    for (const sourceDir of sourcesDirs) {
      const dbPath = join(
        addressBookBasePath,
        sourceDir,
        "AddressBook-v22.abcddb",
      );

      try {
        if (!Deno.statSync(dbPath).isFile) {
          continue;
        }
      } catch {
        // Database file doesn't exist
        continue;
      }

      const db = new Database(dbPath, { readonly: true });
      databases.push(db);
    }

    return databases;
  } catch (error) {
    console.error("Error opening AddressBook databases:", error);
    return databases;
  }
}

/**
 * Search for contacts by name using AddressBook database and return phone numbers as handles
 */
export function searchContactsByName(
  contactsDatabases: Database[],
  firstName: string,
  lastName: string | undefined,
  limit = 50,
  offset = 0,
): PaginatedResult<ContactInfo> {
  try {
    // First get all contacts matching the search term to count total results
    const allContacts = searchContactsInAddressBook(
      contactsDatabases,
      firstName,
      lastName,
      1000,
      0,
    );

    // Transform AddressBook contacts to ContactInfo format
    const allContactInfos: ContactInfo[] = [];

    for (const contact of allContacts) {
      // Add entries for each phone number
      for (const phone of contact.phoneNumbers) {
        const normalizedPhone = normalizePhoneNumber(phone);
        if (normalizedPhone) {
          allContactInfos.push({
            name: contact.fullName,
            phone: normalizedPhone,
          });
        }
      }

      // Also add email addresses as they can be iMessage handles
      for (const email of contact.emailAddresses) {
        if (email) {
          allContactInfos.push({
            name: contact.fullName,
            phone: email,
          });
        }
      }
    }

    // Calculate pagination metadata
    const total = allContactInfos.length;
    const hasMore = offset + limit < total;
    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(total / limit);

    // Apply pagination
    const paginatedData = allContactInfos.slice(offset, offset + limit);

    return {
      data: paginatedData,
      pagination: {
        total,
        limit,
        offset,
        hasMore,
        page,
        totalPages,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to search contacts: ${errorMessage}`);
  }
}

/**
 * Normalize a phone number to the format used by iMessage handles
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, "");

  // If it starts with +, keep it as is
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // If it's a 10-digit number, add +1 prefix
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // If it's 11 digits starting with 1, add + prefix
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+${cleaned}`;
  }

  // Otherwise return as is
  return cleaned || phone;
}

function searchContactsInAddressBook(
  contactsDatabases: Database[],
  firstName: string,
  lastName: string | undefined,
  limit = 20,
  offset = 0,
): Contact[] {
  const contacts: Contact[] = [];

  try {
    // Search in each AddressBook database
    for (const db of contactsDatabases) {
      try {
        // Query for contacts matching the search term
        let contactRows: unknown[];

        if (firstName === "" && !lastName) {
          // If search is empty, return all contacts
          const query = `
            SELECT DISTINCT
              r.Z_PK as id,
              r.ZFIRSTNAME as firstName,
              r.ZLASTNAME as lastName,
              r.ZORGANIZATION as organization
            FROM ZABCDRECORD r
            WHERE (r.ZFIRSTNAME IS NOT NULL OR r.ZLASTNAME IS NOT NULL OR r.ZORGANIZATION IS NOT NULL)
            ORDER BY r.ZLASTNAME, r.ZFIRSTNAME
          `;
          contactRows = db.prepare(query).all();
        } else if (lastName) {
          // Search for both first and last name
          const firstNamePattern = `%${firstName}%`;
          const lastNamePattern = `%${lastName}%`;
          const query = `
            SELECT DISTINCT
              r.Z_PK as id,
              r.ZFIRSTNAME as firstName,
              r.ZLASTNAME as lastName,
              r.ZORGANIZATION as organization
            FROM ZABCDRECORD r
            WHERE (
              r.ZFIRSTNAME LIKE ? AND r.ZLASTNAME LIKE ?
            )
            AND (r.ZFIRSTNAME IS NOT NULL OR r.ZLASTNAME IS NOT NULL OR r.ZORGANIZATION IS NOT NULL)
            ORDER BY r.ZLASTNAME, r.ZFIRSTNAME
          `;
          contactRows = db
            .prepare(query)
            .all(firstNamePattern, lastNamePattern);
        } else {
          // Search only by first name (also check last name, organization, and nickname)
          const searchPattern = `%${firstName}%`;
          const query = `
            SELECT DISTINCT
              r.Z_PK as id,
              r.ZFIRSTNAME as firstName,
              r.ZLASTNAME as lastName,
              r.ZORGANIZATION as organization
            FROM ZABCDRECORD r
            WHERE (
              r.ZFIRSTNAME LIKE ? OR
              r.ZLASTNAME LIKE ? OR
              r.ZORGANIZATION LIKE ? OR
              r.ZNICKNAME LIKE ?
            )
            AND (r.ZFIRSTNAME IS NOT NULL OR r.ZLASTNAME IS NOT NULL OR r.ZORGANIZATION IS NOT NULL)
            ORDER BY r.ZLASTNAME, r.ZFIRSTNAME
          `;
          contactRows = db
            .prepare(query)
            .all(searchPattern, searchPattern, searchPattern, searchPattern);
        }

        for (const row of contactRows) {
          const contactRow = row as ContactRow;
          if (!contactRow.id) continue; // Skip contacts without valid ID

          const contact: Contact = {
            id: contactRow.id,
            firstName: contactRow.firstName ?? undefined,
            lastName: contactRow.lastName ?? undefined,
            organization: contactRow.organization ?? undefined,
            fullName: "",
            phoneNumbers: [],
            emailAddresses: [],
          };

          // Build full name
          const nameParts = [];
          if (contact.firstName) nameParts.push(contact.firstName);
          if (contact.lastName) nameParts.push(contact.lastName);
          if (nameParts.length === 0 && contact.organization) {
            nameParts.push(contact.organization);
          }
          contact.fullName = nameParts.join(" ") || "Unknown";

          // Get phone numbers
          const phoneQuery = `
            SELECT ZFULLNUMBER
            FROM ZABCDPHONENUMBER
            WHERE ZOWNER = ?
            ORDER BY ZORDERINGINDEX
          `;
          const phoneRows = db
            .prepare(phoneQuery)
            .all(contact.id) as PhoneRow[];
          contact.phoneNumbers = phoneRows
            .map((r) => r.ZFULLNUMBER)
            .filter((phone): phone is string => phone != null);

          // Get email addresses
          const emailQuery = `
            SELECT ZADDRESS
            FROM ZABCDEMAILADDRESS
            WHERE ZOWNER = ?
            ORDER BY ZORDERINGINDEX
          `;
          const emailRows = db
            .prepare(emailQuery)
            .all(contact.id) as EmailRow[];
          contact.emailAddresses = emailRows
            .map((r) => r.ZADDRESS)
            .filter((email): email is string => email != null);

          contacts.push(contact);
        }
      } catch (error) {
        console.error("Error searching in database:", error);
        // Continue with other databases
      }
    }

    // Remove duplicates and apply pagination
    const uniqueContacts = Array.from(
      new Map(
        contacts.map((c) => [
          `${c.firstName}-${c.lastName}-${c.organization}`,
          c,
        ]),
      ).values(),
    );

    return uniqueContacts.slice(offset, offset + limit);
  } catch (error) {
    console.error("Error searching AddressBook:", error);
    return [];
  }
}
