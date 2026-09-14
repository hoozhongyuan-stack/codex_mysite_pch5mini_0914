/** Old simulated events may only be retired, never converted into real events. */
export function allowsFormalEventSave(input, existing = null) {
  if (existing?.test === true) {
    return input.test === true && ['archived', 'draft'].includes(input.status);
  }
  return input.test !== true;
}
