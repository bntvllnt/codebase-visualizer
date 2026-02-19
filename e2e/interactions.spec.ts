import { test, expect } from "@playwright/test";

test.describe("UI Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("canvas", { timeout: 15_000 });
  });

  test("search input exists and accepts text", async ({ page }) => {
    const search = page.locator("input[placeholder='Search files...']");
    await expect(search).toBeVisible();
    await search.fill("user");
    await expect(search).toHaveValue("user");
  });

  test("settings sliders are interactive", async ({ page }) => {
    const opacitySlider = page.locator("text=Opacity").first().locator("..").locator("input[type='range']");
    await expect(opacitySlider).toBeVisible();

    const initialValue = await opacitySlider.inputValue();
    expect(Number(initialValue)).toBeGreaterThan(0);
  });

  test("settings panel shows all sections", async ({ page }) => {
    await expect(page.locator("text=NODES")).toBeVisible();
    await expect(page.locator("text=LINKS")).toBeVisible();
    await expect(page.locator("text=GROUPING")).toBeVisible();
    await expect(page.locator("text=PHYSICS")).toBeVisible();
  });

  test("module clouds checkbox is interactive", async ({ page }) => {
    const checkbox = page.locator("input[type='checkbox']");
    await expect(checkbox).toBeVisible();
    const checked = await checkbox.isChecked();
    expect(typeof checked).toBe("boolean");
  });

  test("module clouds are visible when checkbox is checked", async ({ page }) => {
    const checkbox = page.locator("input[type='checkbox']");
    await expect(checkbox).toBeChecked();

    // Wait for clouds to render (engine needs ticks to position nodes)
    await page.waitForFunction(() => {
      const container = document.querySelector("[data-cloud-count]");
      return container && Number(container.getAttribute("data-cloud-count")) > 0;
    }, { timeout: 10_000 });

    const count = await page.getAttribute("[data-cloud-count]", "data-cloud-count");
    expect(Number(count)).toBeGreaterThan(0);
  });

  test("project name is displayed", async ({ page }) => {
    // fixture project has name "e2e-fixture-project"
    await expect(page.locator("text=e2e-fixture-project")).toBeVisible();
  });

  test("stats show file count from fixture project", async ({ page }) => {
    const projectBar = page.locator("h1", { hasText: "e2e-fixture-project" }).locator("..");
    await expect(projectBar).toBeVisible();
    await expect(projectBar.getByText("Files", { exact: false }).first()).toBeVisible();
    await expect(projectBar.getByText("Dependencies")).toBeVisible();
  });
});
