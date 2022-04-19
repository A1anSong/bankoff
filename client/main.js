const {chromium} = require('playwright');
const express = require('express');
const app = express();
const port = 65432;
const bodyParser = require('body-parser');
const axios = require('axios').default;

app.use(bodyParser.urlencoded({extended: false}));

app.post('/fetchOrderStatus', (req, res) => {
    //fetch params
    let urlPayment = req.body.urlPayment;
    let urlCallack = req.body.urlCallack;

    //run playwright
    (async () => {
        const browser = await chromium.launch({
            headless: false,
            channel: 'chrome',
            incognito: true,
        });
        const page = await browser.newPage({
            isMobile: true,
            locale: "en-US",
        });
        try {
            await page.setDefaultNavigationTimeout(0);
            await page.goto(urlPayment);
            await page.waitForLoadState('networkidle');

            const successMark = page.locator('.InvoiceThumbnail-successMark');
            if (await successMark.count() === 0) {
                //unpaid
                console.log('unpaid')

                const wechatPayButton = page.locator('#wechat_pay-tab');
                const QRCodeImage = page.locator('.WeChatPayQRCode-image');
                if (await wechatPayButton.count() !== 0) {
                    //generate QR code
                    await wechatPayButton.click();
                    const QRCodeImage = page.locator('.WeChatPayQRCode-image');
                    await QRCodeImage.waitFor();
                    await page.locator('.SubmitButton-IconContainer').click();
                    const BlurredQRCode = page.locator('.WeChatPayQRCode-image--blurred');
                    while (await BlurredQRCode.count() !== 0) {
                        await page.waitForTimeout(5000);
                    }
                }
                //get QR code
                let jsqr = require('jsqr');
                let Jimp = require('jimp');
                let buffer = await QRCodeImage.screenshot();
                Jimp.read(buffer).then((blockImage) => {
                    let width = blockImage.bitmap.width;
                    let height = blockImage.bitmap.height;
                    let imgData = blockImage.bitmap.data;
                    let code = jsqr(imgData, width, height);
                    if (code) {
                        console.log(code.data);
                        axios.post(urlCallack, {
                            status: 'unpaid',
                            code: code.data,
                        }).catch((err) => {
                            console.error(err);
                        });
                    } else {
                        console.error('read qrcode error');
                    }
                });
            } else {
                //paid
                axios.post(urlCallack, {
                    status: 'paid',
                }).catch((err) => {
                    console.error(err);
                });
            }
        } catch (error) {
            console.log(error);
        }
        await browser.close();
    })();

    //send response
    res.send('Ok');
});

app.get('/', (req, res) => {
    console.log('Hello requested!');
    res.send('Hello World!');
})

app.listen(port, () => {
    console.log('Server listening on port %s', port);
});