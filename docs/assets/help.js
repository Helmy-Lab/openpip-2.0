// Open the help cards around a linked section, so links such as
// settings/#accounts land on an open card instead of a closed one.
function openLinkedCard() {
  const id = decodeURIComponent(location.hash.slice(1));
  const target = id && document.getElementById(id);
  if (!target) return;
  for (let d = target.closest("details"); d; d = d.parentElement.closest("details")) {
    d.open = true;
  }
  target.scrollIntoView();
}
addEventListener("hashchange", openLinkedCard);
openLinkedCard();
