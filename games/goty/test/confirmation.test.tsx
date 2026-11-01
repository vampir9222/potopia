// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConfirmAction } from "../ui/ConfirmAction";

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
const button = (text: string) => {
  const element = [...container.querySelectorAll("button")].find((b) => b.textContent === text);
  if (!element) throw new Error(`Bouton absent : ${text}`);
  return element;
};
const click = async (text: string) => act(async () => button(text).click());
const render = async (onConfirm: () => Promise<boolean>, disabled = false) =>
  act(async () =>
    root.render(
      <ConfirmAction
        title="Confirmer une commande"
        message="Conséquence expliquée."
        onConfirm={onConfirm}
        disabled={disabled}
      >
        Action
      </ConfirmAction>,
    ),
  );

it("ne lance rien à l’ouverture ni à l’annulation et respecte une commande désactivée", async () => {
  const command = vi.fn(async () => true);
  await render(command);
  await click("Action");
  expect(container.querySelector("dialog")?.open).toBe(true);
  expect(command).not.toHaveBeenCalled();
  await click("Annuler");
  expect(command).not.toHaveBeenCalled();
  await render(command, true);
  await click("Action");
  expect(container.querySelector("dialog")?.open).toBe(false);
});

it("confirme la version affichée à l’ouverture et conserve le contrôle de concurrence serveur", async () => {
  const previous = vi.fn(async () => false);
  const fresh = vi.fn(async () => true);
  await render(previous);
  await click("Action");
  await render(fresh);
  await click("Confirmer");
  expect(previous).toHaveBeenCalledOnce();
  expect(fresh).not.toHaveBeenCalled();
  expect(container.querySelector("dialog")?.open).toBe(false);
});

it("ne double pas l’action pendant l’enregistrement", async () => {
  let finish = (_result: boolean) => {};
  const result = new Promise<boolean>((resolve) => {
    finish = resolve;
  });
  const command = vi.fn(() => result);
  await render(command);
  await click("Action");
  await act(async () => {
    button("Confirmer").click();
    button("Confirmer").click();
  });
  expect(command).toHaveBeenCalledOnce();
  await act(async () => finish(true));
  expect(container.querySelector("dialog")?.open).toBe(false);
});
