export interface ContactInfo {
  name: string;
  phone: string;
}

/**
 * Search for contacts by name using AppleScript and return phone numbers as handles
 */
export async function searchContactsByName(
  searchTerm: string,
): Promise<ContactInfo[]> {
  const script = `
    tell application "Contacts"
      set matchingContacts to {}
      set allPeople to every person
      repeat with currentPerson in allPeople
        set personName to name of currentPerson
        if personName contains "${searchTerm}" then
          try
            set phoneList to value of phones of currentPerson
            if (count phoneList) > 0 then
              set firstPhone to item 1 of phoneList as string
              set contactLine to personName & "###" & firstPhone
              set end of matchingContacts to contactLine
            end if
          end try
        end if
      end repeat
      set AppleScript's text item delimiters to "%%%"
      set resultString to matchingContacts as string
      set AppleScript's text item delimiters to ""
      return resultString
    end tell
  `;

  try {
    const process = new Deno.Command("osascript", {
      args: ["-e", script],
      stdout: "piped",
      stderr: "piped",
    });

    const { code, stdout, stderr } = await process.output();

    if (code !== 0) {
      const errorText = new TextDecoder().decode(stderr);
      throw new Error(`AppleScript error: ${errorText}`);
    }

    const output = new TextDecoder().decode(stdout).trim();

    if (!output) {
      return [];
    }

    // Parse the output using the custom delimiters
    const contacts = output.split("%%%").filter((contact) => contact.trim())
      .map((contact) => {
        const [name, phone] = contact.split("###");
        const normalizedPhone = normalizePhoneNumber(phone?.trim() || "");

        return {
          name: name?.trim() || "No name",
          phone: normalizedPhone,
        };
      });

    return contacts;
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
