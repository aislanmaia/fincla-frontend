import axios from "axios";
import { describe, expect, it } from "vitest";
import { repeatArrayParams } from "../paramsSerializer";

/**
 * O backend FastAPI lê `payment_method` como `list` a partir de params repetidos
 * (`?payment_method=pix&payment_method=credit_card`). O default do axios v1
 * produziria `payment_method[]=...`, que o backend ignora — daí a config
 * `indexes: null`. Este teste tranca o formato de serialização.
 */
describe("repeatArrayParams", () => {
  const serialize = (params: Record<string, unknown>) =>
    axios.getUri({ url: "/x", params, paramsSerializer: repeatArrayParams });

  it("repete arrays sem colchetes", () => {
    const uri = serialize({ payment_method: ["pix", "credit_card"] });
    expect(uri).toContain("payment_method=pix");
    expect(uri).toContain("payment_method=credit_card");
    expect(uri).not.toContain("payment_method%5B%5D");
    expect(uri).not.toContain("payment_method[]");
  });

  it("mantém params escalares intactos", () => {
    const uri = serialize({ organization_id: "org-1", limit: 10 });
    expect(uri).toContain("organization_id=org-1");
    expect(uri).toContain("limit=10");
  });

  it("um único método também sai como param simples", () => {
    const uri = serialize({ payment_method: ["pix"] });
    expect(uri).toContain("payment_method=pix");
    expect(uri).not.toContain("payment_method[]");
  });
});
