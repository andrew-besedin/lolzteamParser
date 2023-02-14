import puppeteer from "puppeteer";
import dotenv from "dotenv";
import fs from "fs";
import Storage from "node-storage";
import { Telegraf } from "telegraf";

dotenv.config();

(async () => {
    await main();
})();

async function authentificate(page) {
    const isRefreshed = await page.evaluate(async (login, pass) => {
        if (document.querySelector(".loginForm--bottomBar")) {
            document.querySelector('[name="login"]').value = login;
            await new Promise(res => setTimeout(res, 1000));
            document.querySelector('[name="password"]').value = pass;
            await new Promise(res => setTimeout(res, 1000));
            document.querySelector(".loginForm--bottomBar > input").click();
            return true;
        } else {
            return false;
        }
    }, process.env.LOLZ_LOGIN, process.env.LOLZ_PASS);
    if (isRefreshed) await page.waitForNavigation({ waitUntil: "load" });
}

async function main() { 
    const storage = new Storage("./storage.json");
    const bot = new Telegraf(process.env.BOT_TOKEN);
    const browser = await puppeteer.launch({
        headless: true,
        // args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = (await browser.pages())[0];
    await page.setExtraHTTPHeaders({
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36'
    });
    setInterval(async () => {
        try {
            let firstTime = true;
            let history = storage.get("history");
            if (history?.length === undefined) {
                history = [];
                storage.put("history", []);
            }
            if (history && history?.length !== 0) {
                firstTime = false;
            }
            console.log("started");
            const links = fs.readFileSync("./list.txt", { encoding: "utf8"}).split("\r\n");
            for (const link of links) {
                await page.goto(link, { waitUntil: "load" });
                await new Promise(res => setTimeout(res, 1000));

                await authentificate(page);

                await new Promise(res => setTimeout(res, 1000));
                await page.evaluate(() => {
                    window.scroll(0, 1000000);
                });
                await new Promise(res => setTimeout(res, 2000));
                const offers = await page.evaluate(() => {
                    return [ ...document.querySelectorAll('[id*="marketItem"]') ].map(e => {
                        return {
                            id: e.id.split("--")[1],
                            skinsAmount: [ ...e.querySelectorAll(".marketIndexItem-Badge") ].find((e) => e.textContent?.includes("скин")).textContent.trim()
                        }
                    });
                });
                const history = storage.get("history");
                for (const offer of offers) {
                    if (!history.includes(offer.id)) {
                        history.push(offer.id);
                        if (!firstTime) {
                            for (const userId of process.env.TG_USER_IDS.split(" ")) {
                                await bot.telegram.sendMessage(userId, `New offer:\r\nhttps://lzt.market/${offer.id}/\r\nSkins amount: ${offer.skinsAmount}`);
                            }
                        }
                    }
                }
                storage.put("history", history);
            }
        } catch(err) {
            console.error(err);
        }
    }, 10 * 60 * 1e3);    
}

