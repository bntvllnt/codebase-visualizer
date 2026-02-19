import { test, expect } from "@playwright/test";

test.describe("Navigation + Views", () => {
  test("/ loads with canvas and all UI chrome", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas", { timeout: 15_000 });

    // ProjectBar
    await expect(page.getByText("Files", { exact: false }).first()).toBeVisible();
    await expect(page.getByText("Functions")).toBeVisible();
    await expect(page.getByText("Dependencies")).toBeVisible();

    // All 8 view tabs (buttons, not links)
    const views = ["Galaxy", "Dep Flow", "Hotspot", "Focus", "Module", "Forces", "Churn", "Coverage"];
    for (const view of views) {
      await expect(page.getByRole("button", { name: view })).toBeVisible();
    }

    // Search input
    await expect(page.locator("input[placeholder='Search files...']")).toBeVisible();

    // Settings panel
    await expect(page.getByText("SETTINGS")).toBeVisible();
    await expect(page.getByText("NODES")).toBeVisible();

    // Legend
    await expect(page.getByText("Node color")).toBeVisible();

    // Canvas (3D graph)
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("view tab click switches view without page reload", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas", { timeout: 15_000 });

    // Click Hotspot tab
    await page.getByRole("button", { name: "Hotspot" }).click();
    // URL stays the same (single page)
    await expect(page).toHaveURL("/");
    // Canvas still visible
    await expect(page.locator("canvas")).toBeVisible();

    // Click Forces tab
    await page.getByRole("button", { name: "Forces" }).click();
    await expect(page.locator("canvas")).toBeVisible();
  });

});
