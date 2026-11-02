export const describedBy = (...ids) => [...new Set(ids.filter(Boolean))].join(' ') || undefined;
// The browser owns the constraint and its language. Disabled/non-validating
// controls never acquire an error from the enhancement.
export const fieldMessage = ({ willValidate = true, validity, validationMessage = '' }) => willValidate && validity && !validity.valid ? validationMessage : '';
const initialized = new WeakSet();
export function setupForms(root = document) {
  if (typeof window === 'undefined') return () => {};
  const disposers = [...root.querySelectorAll('form.kn-form')].filter((form) => !initialized.has(form)).map((form) => {
    initialized.add(form);
    const abort = new AbortController();
    const nativeNoValidate = form.noValidate;
    form.noValidate = true;
    function validate(control) {
      const field = control.closest('.kn-field');
      const error = field?.querySelector('.kn-field-error');
      if (!error) return;
      const controls = [...field.querySelectorAll('input, select, textarea')];
      const message = controls.map(fieldMessage).find(Boolean) ?? '';
      controls.forEach((input) => {
        if (fieldMessage(input)) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
      });
      if (field.tagName === 'FIELDSET') {
        if (message) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
      }
      error.querySelector('[data-kn-error-text]').textContent = message;
      error.hidden = !message;
    }
    form.addEventListener('focusout', (event) => {
      if (event.target.matches('input, select, textarea')) validate(event.target);
    }, { signal: abort.signal });
    form.addEventListener('submit', (event) => {
      if (event.submitter?.formNoValidate) return;
      const controls = [...form.elements].filter((control) => control.matches('input, select, textarea'));
      controls.forEach(validate);
      const first = controls.find((control) => fieldMessage(control));
      if (first) { event.preventDefault(); first.focus(); }
    }, { signal: abort.signal });
    return () => { abort.abort(); form.noValidate = nativeNoValidate; initialized.delete(form); };
  });
  return () => disposers.forEach((dispose) => dispose());
}
