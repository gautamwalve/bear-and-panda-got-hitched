import fs from "node:fs";
import path from "node:path";
import { chromium, firefox, webkit } from "playwright";

const BASE_URL = process.env.BASE_URL || "https://gautamwalve.github.io/bear-and-panda-got-hitched/";
const OUTPUT = process.env.TEST_OUTPUT || "device-matrix-results.json";

const profiles = {
  chromium: [
    { name: "Desktop Chrome 1365x900", viewport: { width: 1365, height: 900 }, dpr: 1 },
    { name: "Android 11 Pixel-style 393x851", viewport: { width: 393, height: 851 }, dpr: 2.75, mobile: true, touch: true, ua: "Mozilla/5.0 (Linux; Android 11; Pixel 4a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36" },
    { name: "Android 12 Pixel-style 412x915", viewport: { width: 412, height: 915 }, dpr: 2.625, mobile: true, touch: true, ua: "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" },
    { name: "Android 13 Pixel-style 412x915", viewport: { width: 412, height: 915 }, dpr: 2.625, mobile: true, touch: true, ua: "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36" },
    { name: "Android 14 Pixel-style 412x915", viewport: { width: 412, height: 915 }, dpr: 2.625, mobile: true, touch: true, ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36" },
    { name: "Android 15 Pixel-style 430x932", viewport: { width: 430, height: 932 }, dpr: 2.625, mobile: true, touch: true, ua: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36" },
    { name: "Samsung Galaxy S23 FE Chrome Android 14", viewport: { width: 384, height: 854 }, dpr: 2.75, mobile: true, touch: true, ua: "Mozilla/5.0 (Linux; Android 14; SM-S711B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36", tapSurface: "background" },
    { name: "Samsung Galaxy S23 FE Samsung Internet UA", viewport: { width: 384, height: 854 }, dpr: 2.75, mobile: true, touch: true, ua: "Mozilla/5.0 (Linux; Android 14; SM-S711B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/130.0.0.0 Mobile Safari/537.36", tapSurface: "background" },
    { name: "Narrow phone / high zoom 320x740", viewport: { width: 320, height: 740 }, dpr: 3, mobile: true, touch: true, ua: "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36" }
  ],
  webkit: [
    { name: "Safari-engine iPhone SE size 375x667 DPR2", viewport: { width: 375, height: 667 }, dpr: 2, touch: true, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
    { name: "Safari-engine iPhone SE size 375x667 DPR3", viewport: { width: 375, height: 667 }, dpr: 3, touch: true, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
    { name: "Safari-engine iPhone 13 size 390x844 DPR3", viewport: { width: 390, height: 844 }, dpr: 3, touch: true, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
    { name: "Safari-engine iPhone 13 size 390x844 DPR2", viewport: { width: 390, height: 844 }, dpr: 2, touch: true, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
    { name: "Safari-engine iPhone Pro Max size 430x932", viewport: { width: 430, height: 932 }, dpr: 3, touch: true, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" },
    { name: "Safari-engine iPad size 768x1024", viewport: { width: 768, height: 1024 }, dpr: 2, touch: true, ua: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" }
  ],
  firefox: [
    { name: "Firefox desktop 1365x900", viewport: { width: 1365, height: 900 }, dpr: 1 },
    { name: "Firefox mobile-width 360x800", viewport: { width: 360, height: 800 }, dpr: 3, touch: true },
    { name: "Firefox narrow / zoom-width 320x740", viewport: { width: 320, height: 740 }, dpr: 3, touch: true }
  ]
};

const engines = { chromium, webkit, firefox };
const results = [];
const failures = [];
fs.mkdirSync("device-test-artifacts", { recursive: true });

function check(result, label, condition, detail = "") {
  result.checks.push({ label, passed: Boolean(condition), detail });
  if (!condition) failures.push({ device: result.device, label, detail });
}

for (const [engineName, configs] of Object.entries(profiles)) {
  const browser = await engines[engineName].launch({ headless: true });
  for (const profile of configs) {
    const result = {
      engine: engineName,
      device: profile.name,
      viewport: profile.viewport,
      checks: [],
      consoleErrors: [],
      pageErrors: [],
      failedRequests: [],
      assetResponses: [],
      warnings: []
    };
    let context;
    try {
      context = await browser.newContext({
        viewport: profile.viewport,
        deviceScaleFactor: profile.dpr,
        hasTouch: Boolean(profile.touch),
        ...(profile.mobile && engineName === "chromium" ? { isMobile: true } : {}),
        ...(profile.ua ? { userAgent: profile.ua } : {})
      });
      const page = await context.newPage();

      page.on("pageerror", error => result.pageErrors.push(String(error)));
      page.on("console", message => {
        if (message.type() === "error") result.consoleErrors.push(message.text());
      });
      page.on("requestfailed", request => {
        result.failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "request failed" });
      });
      page.on("response", response => {
        if (/\.(mp3|mp4)(\?|$)|favicon\.svg/i.test(response.url())) {
          result.assetResponses.push({ url: response.url(), status: response.status() });
        }
      });

      const response = await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
      check(result, "site responds HTTP 200", response?.status() === 200, String(response?.status()));
      await page.waitForSelector("#openInvitation", { timeout: 15000 });
      await page.waitForTimeout(350);

      const before = await page.evaluate(() => {
        const letter = document.querySelector(".envelope-inner-letter");
        const rect = letter.getBoundingClientRect();
        const video = document.querySelector("#envelopeEntryVideo");
        return {
          title: document.title,
          theme: document.documentElement.getAttribute("data-theme"),
          letterDisplay: getComputedStyle(letter).display,
          letterText: letter.innerText,
          letterTop: rect.top,
          letterTopStyle: getComputedStyle(letter).top,
          letterTransform: getComputedStyle(letter).transform,
          letterTransition: getComputedStyle(letter).transition,
          flapTransform: getComputedStyle(document.querySelector(".envelope-flap")).transform,
          flapTransition: getComputedStyle(document.querySelector(".envelope-flap")).transition,
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
          devicePixelRatio: window.devicePixelRatio,
          appleDpr2Fallback: document.documentElement.classList.contains("safari-dpr2"),
          userAgent: navigator.userAgent,
          flapHeight: getComputedStyle(document.querySelector(".envelope-flap")).height,
          flapOpacity: getComputedStyle(document.querySelector(".envelope-flap")).opacity,
          pageVisibility: getComputedStyle(document.querySelector(".page")).visibility,
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          viewportWidth: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          videoReadyState: video?.readyState ?? -1,
          videoPaused: video?.paused ?? true,
          audioCanPlayMp3: document.querySelector("#weddingAudio").canPlayType("audio/mpeg")
        };
      });
      result.beforeOpen = before;
      check(result, "envelope cover is present", await page.locator("#envelopeIntro").count() === 1);
      check(result, "printed letter is rendered (not display:none)", before.letterDisplay !== "none", before.letterDisplay);
      check(result, "letter contains both names", /Gautam/.test(before.letterText) && /Tejasvini/.test(before.letterText), before.letterText);
      check(result, "invitation is hidden before envelope tap", before.pageVisibility === "hidden", before.pageVisibility);
      check(result, "light theme initially selected", before.theme === "light", before.theme);
      check(result, "no horizontal overflow before opening", before.scrollWidth <= before.viewportWidth, `${before.scrollWidth} > ${before.viewportWidth}`);

      if (profile.tapSurface === "background") {
        // Tap a clear corner of the full-screen envelope, outside the envelope button.
        // This verifies the wrapper-level click handler on Samsung-style profiles.
        await page.touchscreen.tap(12, 12);
      } else {
        const openRect = await page.locator("#openInvitation").boundingBox();
        if (!openRect) throw new Error("Envelope button has no visible bounding box");
        // Use a direct trusted pointer tap. Playwright locator.click waits for
        // animation stability, while the envelope intentionally floats forever.
        await page.mouse.click(openRect.x + openRect.width / 2, openRect.y + openRect.height / 2);
      }
      await page.waitForTimeout(700);
      const during = await page.evaluate(() => {
        const letter = document.querySelector(".envelope-inner-letter");
        const rect = letter.getBoundingClientRect();
        const flap = getComputedStyle(document.querySelector(".envelope-flap"));
        return {
          overlayClass: document.querySelector("#envelopeIntro").className,
          letterDisplay: getComputedStyle(letter).display,
          letterTop: rect.top,
          letterTopStyle: getComputedStyle(letter).top,
          letterTransform: getComputedStyle(letter).transform,
          letterTransition: getComputedStyle(letter).transition,
          letterOpacity: getComputedStyle(letter).opacity,
          flapTransform: flap.transform,
          flapTransition: flap.transition,
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
          devicePixelRatio: window.devicePixelRatio,
          appleDpr2Fallback: document.documentElement.classList.contains("safari-dpr2"),
          flapHeight: flap.height,
          flapOpacity: flap.opacity,
          audioPaused: document.querySelector("#weddingAudio").paused,
          audioError: document.querySelector("#weddingAudio").error?.code ?? null
        };
      });
      result.duringOpen = during;
      check(result, "envelope enters opening state", during.overlayClass.includes("is-opening"), during.overlayClass);
      check(result, "letter moves visibly upward", during.letterDisplay !== "none" && during.letterTop < before.letterTop - 35, `before=${before.letterTop}, after=${during.letterTop}`);
      const flapRotated = during.flapTransform !== "none" && during.flapTransform !== "matrix(1, 0, 0, 1, 0, 0)";
      const flapRetracted = Number.parseFloat(during.flapHeight) < Number.parseFloat(before.flapHeight) * 0.25 && Number(during.flapOpacity) < 0.2;
      check(result, "envelope flap opens (rotate or retract)", flapRotated || flapRetracted, JSON.stringify({transform:during.flapTransform,heightBefore:before.flapHeight,heightDuring:during.flapHeight,opacity:during.flapOpacity,dpr:during.devicePixelRatio,appleDpr2Fallback:during.appleDpr2Fallback}));

      await page.waitForFunction(() => {
        const overlay = document.querySelector("#envelopeIntro");
        return !overlay || getComputedStyle(overlay).visibility === "hidden";
      }, null, { timeout: 8000 });
      await page.waitForTimeout(250);
      const after = await page.evaluate(() => {
        const audio = document.querySelector("#weddingAudio");
        const overlay = document.querySelector("#envelopeIntro");
        return {
          overlayVisibility: overlay ? getComputedStyle(overlay).visibility : "removed",
          pageVisibility: getComputedStyle(document.querySelector(".page")).visibility,
          pageOpacity: getComputedStyle(document.querySelector(".page")).opacity,
          countdown: document.querySelector("#countDays")?.textContent,
          audioPaused: audio.paused,
          audioReadyState: audio.readyState,
          audioError: audio.error?.code ?? null,
          audioCanPlayMp3: audio.canPlayType("audio/mpeg"),
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          bodyBackground: getComputedStyle(document.body).backgroundColor,
          favicon: document.querySelector('link[rel="icon"]')?.href ?? null
        };
      });
      result.afterOpen = after;
      check(result, "cover transitions away", after.overlayVisibility === "hidden" || after.overlayVisibility === "removed", after.overlayVisibility);
      check(result, "invitation page becomes visible", after.pageVisibility === "visible" && Number(after.pageOpacity) > 0.9, `${after.pageVisibility}, opacity=${after.pageOpacity}`);
      check(result, "countdown is populated", after.countdown && after.countdown !== "--", String(after.countdown));
      check(result, "no horizontal overflow after opening", after.scrollWidth <= after.clientWidth, `${after.scrollWidth} > ${after.clientWidth}`);

      // Audio must be started by a user gesture. If the envelope click was rejected,
      // retry the explicit music button, also as a real user gesture.
      await page.waitForTimeout(800);
      let audioStatus = await page.evaluate(() => {
        const a = document.querySelector("#weddingAudio");
        return { paused: a.paused, readyState: a.readyState, error: a.error?.code ?? null, currentTime: a.currentTime, canPlay: a.canPlayType("audio/mpeg") };
      });
      if (audioStatus.paused) {
        await page.locator("#musicToggle").click({ timeout: 10000 });
        await page.waitForTimeout(1000);
        audioStatus = await page.evaluate(() => {
          const a = document.querySelector("#weddingAudio");
          return { paused: a.paused, readyState: a.readyState, error: a.error?.code ?? null, currentTime: a.currentTime, canPlay: a.canPlayType("audio/mpeg") };
        });
        result.warnings.push("Audio did not start on the envelope tap; explicit music-button retry was tested.");
      }
      result.audio = audioStatus;
      if (audioStatus.canPlay && audioStatus.error === null) {
        check(result, "MP3 playback begins after a user gesture", !audioStatus.paused, JSON.stringify(audioStatus));
      } else {
        result.warnings.push("This browser build reports no usable MP3 decoder or media error; audio playback is inconclusive in this CI engine.");
      }

      // Both theme choices must update the actual rendered background.
      await page.locator("#themeToggle").click({ timeout: 10000 });
      const dark = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute("data-theme"),
        scheme: document.querySelector('meta[name="color-scheme"]').content,
        background: getComputedStyle(document.body).backgroundColor
      }));
      result.darkTheme = dark;
      check(result, "dark theme switch applies", dark.theme === "dark" && dark.background === "rgb(23, 26, 36)", JSON.stringify(dark));

      await page.locator("#themeToggle").click({ timeout: 10000 });
      const light = await page.evaluate(() => ({
        theme: document.documentElement.getAttribute("data-theme"),
        scheme: document.querySelector('meta[name="color-scheme"]').content,
        background: getComputedStyle(document.body).backgroundColor
      }));
      result.lightTheme = light;
      check(result, "light theme restores ivory background", light.theme === "light" && light.scheme === "only light" && light.background === "rgb(251, 248, 240)", JSON.stringify(light));

      // Verify local favicon and media asset HTTP responses were received.
      const faviconResponse = await page.request.get(new URL("./favicon.svg", BASE_URL).href);
      check(result, "favicon returns HTTP 200", faviconResponse.status() === 200, String(faviconResponse.status()));

      const localAssetFailures = result.assetResponses.filter(item => item.status >= 400);
      check(result, "no failed media/favicon asset responses", localAssetFailures.length === 0, JSON.stringify(localAssetFailures));

      const relevantPageErrors = result.pageErrors.filter(error => !/ResizeObserver loop/i.test(error));
      check(result, "no uncaught page JavaScript errors", relevantPageErrors.length === 0, JSON.stringify(relevantPageErrors));

      if (result.consoleErrors.length) {
        result.warnings.push("Console errors observed: " + result.consoleErrors.join(" | "));
      }

      // Save a screenshot per profile for later visual review if this run flags a problem.
      const imageName = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await page.screenshot({ path: path.join("device-test-artifacts", imageName + ".png"), fullPage: false }).catch(() => {});
    } catch (error) {
      result.runtimeError = String(error);
      failures.push({ device: profile.name, label: "runtime completed", detail: String(error) });
    } finally {
      await context?.close();
      results.push(result);
    }
  }
  await browser.close();
}

fs.writeFileSync(OUTPUT, JSON.stringify({ baseUrl: BASE_URL, results, failures }, null, 2));
console.log(`Tested ${results.length} emulated device/browser profiles.`);
for (const result of results) {
  const passed = result.checks.filter(item => item.passed).length;
  const failed = result.checks.filter(item => !item.passed).length;
  console.log(`${failed ? "FAIL" : "PASS"} | ${result.engine.padEnd(7)} | ${result.device} | ${passed} passed / ${failed} failed`);
  for (const item of result.checks.filter(item => !item.passed)) console.log(`  - ${item.label}: ${item.detail}`);
  for (const warning of result.warnings) console.log(`  ! ${warning}`);
}
console.log(`Full report: ${OUTPUT}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [
    "# Wedding invitation browser/device smoke test",
    `Target: ${BASE_URL}`,
    `Profiles: ${results.length}`,
    "",
    "| Browser engine | Emulated profile | Result | Checks |",
    "|---|---|---:|---:|",
    ...results.map(result => {
      const failed = result.checks.filter(item => !item.passed).length;
      const passed = result.checks.length - failed;
      return `| ${result.engine} | ${result.device} | ${failed ? "FAIL" : "PASS"} | ${passed} passed / ${failed} failed |`;
    }),
    "",
    "Note: Android versions are user-agent/viewport profiles, not full Android OS virtual machines. WebKit is the Safari engine on Linux, not a physical iPhone or Apple's shipped iOS Safari build. Audio results depend on codecs available in the CI browser image."
  ];
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}
if (failures.length) process.exit(1);
