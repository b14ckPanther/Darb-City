import { expect, it } from "vitest";
import { ariaSort, listHref, pageOf, readList, sortHref } from "./list-params";

it("reads only the list's keys and the page", () => {
  expect(readList({ q: ["sa", "x"], status: "", other: "1" }, ["q", "status"])).toEqual({
    q: "sa",
    status: undefined,
  });
  expect(pageOf({ page: "3" })).toBe(3);
  expect(pageOf({ page: "0" })).toBe(1);
  expect(pageOf({ page: "x" })).toBe(1);
  expect(pageOf({ page: "99999" })).toBe(2000);
});

it("starts from page 1 on any change but the page", () => {
  const state = { q: "falafel", status: "published", page: "4" };
  expect(listHref("/admin/businesses", state, { status: "draft" })).toBe(
    "/admin/businesses?q=falafel&status=draft",
  );
  expect(listHref("/admin/businesses", state, { page: "5" })).toBe(
    "/admin/businesses?q=falafel&status=published&page=5",
  );
  expect(listHref("/admin/businesses", state, { page: "1" })).toBe(
    "/admin/businesses?q=falafel&status=published",
  );
  expect(listHref("/admin/businesses", state, { q: undefined, status: undefined })).toBe(
    "/admin/businesses",
  );
});

it("flips the sorted column and starts another at its natural way", () => {
  expect(sortHref("/a", {}, "name", "asc")).toBe("/a?sort=name&dir=asc");
  expect(sortHref("/a", { sort: "name", dir: "asc" }, "name", "asc")).toBe("/a?sort=name&dir=desc");
  expect(sortHref("/a", { sort: "name", dir: "desc" }, "updated", "desc")).toBe(
    "/a?sort=updated&dir=desc",
  );
  expect(ariaSort({ sort: "name", dir: "desc" }, "name", "asc")).toBe("descending");
  expect(ariaSort({}, "updated", "desc", true)).toBe("descending");
  expect(ariaSort({}, "name", "asc")).toBeUndefined();
});
