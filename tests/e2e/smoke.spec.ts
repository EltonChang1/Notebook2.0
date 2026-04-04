import { expect, test, type Page } from "@playwright/test";

async function appRequiresAuth(page: Page): Promise<boolean> {
  const hasSidebar = await page.locator(".sidebar").first().isVisible().catch(() => false);
  if (hasSidebar) return false;
  const hasSignInButton = await page.getByRole("button", { name: /sign in/i }).first().isVisible().catch(() => false);
  return hasSignInButton;
}

async function gotoApp(page: Page) {
  await page.goto("/");
}

test("auth flow smoke gate", async ({ page }) => {
  await gotoApp(page);
  const gated = await appRequiresAuth(page);
  if (gated) {
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    return;
  }
  await expect(page.locator(".sidebar")).toBeVisible();
});

test("leetcode sync and CRUD smoke", async ({ page }) => {
  await gotoApp(page);
  test.skip(await appRequiresAuth(page), "Auth-enabled workspace requires credentials for smoke run.");

  await page.getByRole("link", { name: /LeetCode/i }).first().click();
  await expect(page.getByText("Sync Status")).toBeVisible();
  await page.getByRole("button", { name: "Sync Now" }).click();

  const token = Date.now().toString().slice(-6);
  const title = `Smoke LC ${token}`;
  await page.getByRole("button", { name: "Add Problem" }).first().click();
  await page.getByLabel("Problem #").fill(`9${token}`);
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Add Problem" }).last().click();
  await page.getByPlaceholder("Search by #, title, or topic").fill(title);

  await expect(page.locator("body")).toContainText(title);
});

test("reading book CRUD smoke", async ({ page }) => {
  await gotoApp(page);
  test.skip(await appRequiresAuth(page), "Auth-enabled workspace requires credentials for smoke run.");

  await page.getByRole("link", { name: /Reading/i }).first().click();
  const token = Date.now().toString().slice(-5);
  const bookTitle = `Smoke Book ${token}`;

  await page.getByRole("button", { name: "Add Book" }).click();
  await page.getByLabel("Book Title").fill(bookTitle);
  await page.getByLabel("Author").fill("Smoke Author");
  await page.getByLabel("Total Chapters").fill("12");
  await page.getByRole("button", { name: "Save Book" }).click();

  await expect(
    page.getByRole("button", { name: new RegExp(`${bookTitle}.*Smoke Author`) }).first()
  ).toBeVisible();
});

test("calendar event CRUD smoke", async ({ page }) => {
  await gotoApp(page);
  test.skip(await appRequiresAuth(page), "Auth-enabled workspace requires credentials for smoke run.");

  await page.getByRole("link", { name: /Calendar/i }).first().click();
  const token = Date.now().toString().slice(-5);
  const eventTitle = `Smoke Event ${token}`;

  await page.getByRole("button", { name: "Day" }).first().click();
  await page.getByRole("button", { name: "Add Event" }).click();
  await page.getByLabel("Title").fill(eventTitle);
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start);
  end.setHours(start.getHours() + 1);
  const toLocalDateTime = (value: Date) => {
    const yyyy = value.getFullYear();
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const dd = String(value.getDate()).padStart(2, "0");
    const hh = String(value.getHours()).padStart(2, "0");
    const min = String(value.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };
  await page.getByLabel("Start").fill(toLocalDateTime(start));
  await page.getByLabel("End").fill(toLocalDateTime(end));
  await page.getByRole("button", { name: "Save Event" }).click();

  await expect(page.locator(".calendar-events").getByText(eventTitle).first()).toBeVisible();
});

test("notes save and search smoke", async ({ page }) => {
  await gotoApp(page);
  test.skip(await appRequiresAuth(page), "Auth-enabled workspace requires credentials for smoke run.");

  await page.getByRole("link", { name: /Notes/i }).first().click();
  const token = Date.now().toString().slice(-5);
  const noteTitle = `Smoke Note ${token}`;

  await page.getByRole("button", { name: "New Note" }).click();
  await page.getByLabel("Title").fill(noteTitle);
  await page.getByRole("button", { name: "Save Note" }).click();
  await expect(page.getByText(noteTitle)).toBeVisible();

  await page.getByPlaceholder("Search notes").fill(noteTitle);
  await expect(page.getByText(noteTitle)).toBeVisible();
});
