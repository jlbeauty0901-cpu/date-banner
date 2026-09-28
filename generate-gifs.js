const puppeteer = require('puppeteer');
const GIFEncoder = require('gif-encoder-2');
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const GIF_PAGES = [{
  url: 'https://jlbeauty0901-cpu.github.io/date-banner/index-1.html',
  output: 'index-1.gif', width: 860, selector: '.banner'
}];

async function generateGif(page, config) {
  await page.setViewport({width:config.width,height:2178,deviceScaleFactor:1});
  await page.emulateTimezone('Asia/Seoul');
  const response = await page.goto(config.url + '?capture=' + Date.now(), {waitUntil:'networkidle0',timeout:90000});
  if (!response || !response.ok()) throw new Error('Banner page failed to load');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, img => img.decode()));
    refreshDate();
  });
  const element = await page.$(config.selector);
  if (!element) throw new Error('Banner element is missing');
  const screenshot = await element.screenshot({type:'png'});
  const png = PNG.sync.read(screenshot);
  if (png.width !== 860 || png.height !== 2178) throw new Error('Unexpected banner dimensions');
  const dateText = await page.$eval('#eventDate', el => el.textContent);
  if (dateText.includes('계산') || !dateText.includes(' ~ ')) throw new Error('Date rendering failed');
  // Preserve the static original artwork without adding flashing.
  const encoder = new GIFEncoder(png.width, png.height);
  encoder.start();
  encoder.setQuality(1);
  encoder.setDelay(1000);
  encoder.addFrame(png.data);
  encoder.finish();
  const target = path.join(__dirname, config.output);
  fs.writeFileSync(target, encoder.out.getData());
  console.log('[GIF] Saved:', config.output, dateText, fs.statSync(target).size, 'bytes');
}

(async () => {
  const browser = await puppeteer.launch({headless:true,args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-lcd-text']});
  try {
    const page = await browser.newPage();
    for (const config of GIF_PAGES) await generateGif(page, config);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
