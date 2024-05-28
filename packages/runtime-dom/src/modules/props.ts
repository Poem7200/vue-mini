export function patchDOMProp(el, key, value) {
  try {
    el[key] = value;
  } catch (err) {
    console.error(err);
  }
}
