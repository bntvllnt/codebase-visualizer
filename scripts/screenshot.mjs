import { chromium } from "playwright";

const port = process.argv[2] || "3380";
const outDir = process.argv[3] || "docs";

console.log(`Connecting to http://localhost:${port}...`);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`http://localhost:${port}`, { waitUntil: "networkidle" });

// Wait for 3D graph to render (force-graph needs time to stabilize)
console.log("Waiting for graph to render...");
await page.waitForTimeout(8000);

// Check for console errors
page.on("console", (msg) => {
  if (msg.type() === "error") console.error(`[BROWSER] ${msg.text()}`);
});

// Debug: check what's visible on page
const legendVisible = await page.locator(".fixed.bottom-4.left-4").isVisible().catch(() => false);
console.log(`Legend visible: ${legendVisible}`);

const legendHTML = await page.locator(".fixed.bottom-4.left-4").innerHTML().catch(() => "NOT FOUND");
console.log(`Legend content length: ${legendHTML.length}`);
const hasGroups = legendHTML.includes("Groups");
console.log(`Legend has Groups section: ${hasGroups}`);

// Check if clouds are rendered (data attribute on container)
const cloudCount = await page.locator("[data-cloud-count]").getAttribute("data-cloud-count").catch(() => "N/A");
console.log(`Cloud count: ${cloudCount}`);

// Take the main galaxy view screenshot
await page.screenshot({
  path: `${outDir}/screenshot-galaxy.png`,
  fullPage: false,
});
console.log("Galaxy view captured");

// Switch to Module view
await page.click('button:has-text("Module")');
await page.waitForTimeout(4000);
await page.screenshot({
  path: `${outDir}/screenshot-module.png`,
  fullPage: false,
});
console.log("Module view captured");

// Switch to Forces view
await page.click('button:has-text("Forces")');
await page.waitForTimeout(4000);
await page.screenshot({
  path: `${outDir}/screenshot-forces.png`,
  fullPage: false,
});
console.log("Forces view captured");

await browser.close();
console.log("Done — screenshots saved to " + outDir);
