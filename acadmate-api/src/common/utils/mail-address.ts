/**
 * The address to email a user at: their delivery email if they set one,
 * otherwise the address they sign in with. Sign-in always uses `email`.
 */
export function mailAddress(user: { email: string; deliveryEmail?: string | null }): string {
  return user.deliveryEmail || user.email;
}
