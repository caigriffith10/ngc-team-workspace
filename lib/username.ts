// Usernames can have spaces and capital letters, and are matched without caring about case or extra spaces.
// Passwords are NOT touched by any of this: they stay exactly case-sensitive.

/** What the person typed, tidied: trimmed, and runs of spaces squeezed to one. Capitals are kept for display. */
export const cleanUsername = (s: string) => s.trim().replace(/\s+/g, " ")

/** The form used for comparing: "Mr  Smith" and "mr smith" are the same username. */
export const usernameKey = (s: string) => cleanUsername(s).toLowerCase()

export const USERNAME_RULE = "Username: 3-30 characters, letters, numbers, spaces, . _ - only."
export const isValidUsername = (s: string) => /^[A-Za-z0-9._ -]{3,30}$/.test(s)
