/**
 * Croatian noun agreement after a number.
 *
 * Croatian takes three forms where English takes two, and the rule is not
 * "one versus many": 1 fotografija, 2 fotografije, 5 fotografija, and then
 * 21 fotografija again. The teens are the exception that catches every naive
 * implementation — 11 and 13 take the many form despite ending in 1 and 3.
 *
 * Worth the twenty lines. A portfolio that says "3 fotografija" reads as
 * software rather than as someone's work.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(Math.trunc(count))
  const lastTwo = n % 100
  const last = n % 10

  if (last === 1 && lastTwo !== 11) return one
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return few
  return many
}

/** The form this site needs most often. */
export function photographs(count: number): string {
  return plural(count, 'fotografija', 'fotografije', 'fotografija')
}
