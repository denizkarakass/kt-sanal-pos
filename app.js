require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const iconv = require('iconv-lite');

const app = express();
app.use(express.urlencoded({ extended: true }));

// --- HASH HESAPLAMA (DOKÜMAN SAYFA 18-19) ---
function calculateHash(merchantId, orderId, amount, okUrl, failUrl, userName, password) {
    // API şifresini SHA1 + Base64 formatına çevir [cite: 546]
    const hashedPassword = crypto.createHash('sha1').update(iconv.encode(password, 'iso-8859-9')).digest('base64');
    // Sıralama: MerchantId + MerchantOrderId + Amount + OkUrl + FailUrl + UserName + HashedPassword [cite: 543]
    const data = merchantId + orderId + amount + okUrl + failUrl + userName + hashedPassword;
    return crypto.createHash('sha1').update(iconv.encode(data, 'iso-8859-9')).digest('base64');
}

app.post('/odeme-baslat', async (req, res) => {
    try {
        const orderId = Date.now().toString(); // [cite: 174, 175]
        const amount = "10000"; // 100.00 TL 

        const hash = calculateHash(
            process.env.KT_MERCHANT_ID,
            orderId,
            amount,
            process.env.KT_OK_URL,
            process.env.KT_FAIL_URL,
            process.env.KT_API_USERNAME,
            process.env.KT_API_PASSWORD
        );

        // XML TAG SIRALAMASI VE İSİMLERİ DOKÜMANA (SAYFA 4-7) GÖRE DÜZENLENDİ [cite: 129, 132]
        const xmlPayload = `
<KuveytTurkVPosMessage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <APIVersion>TDV2.0.0</APIVersion>
    <OkUrl>${process.env.KT_OK_URL.replace(/&/g, '&amp;')}</OkUrl>
    <FailUrl>${process.env.KT_FAIL_URL.replace(/&/g, '&amp;')}</FailUrl>
    <HashData>${hash}</HashData>
    <MerchantId>${process.env.KT_MERCHANT_ID}</MerchantId>
    <CustomerId>${process.env.KT_CUSTOMER_ID}</CustomerId>
    <UserName>${process.env.KT_API_USERNAME}</UserName>
    <DeviceData>
        <DeviceChannel>02</DeviceChannel>
        <ClientIP>${process.env.KT_TEST_CLIENT_IP}</ClientIP>
    </DeviceData>
    <CardHolderData>
        <BillAddrCity>Istanbul</BillAddrCity>
        <BillAddrCountry>792</BillAddrCountry>
        <BillAddrLine1>Test Adresi No 1</BillAddrLine1>
        <BillAddrPostCode>34000</BillAddrPostCode>
        <BillAddrState>34</BillAddrState>
        <Email>test@test.com</Email>
        <MobilePhone>
            <Cc>90</Cc>
            <Subscriber>5551234567</Subscriber>
        </MobilePhone>
    </CardHolderData>
    <CardNumber>5188961939192544</CardNumber>
    <CardExpireDateYear>25</CardExpireDateYear>
    <CardExpireDateMonth>06</CardExpireDateMonth>
    <CardCVV2>929</CardCVV2>
    <CardHolderName>Deniz Karakas</CardHolderName>
    <TransactionType>Sale</TransactionType>
    <InstallmentCount>0</InstallmentCount>
    <Amount>${amount}</Amount>
    <DisplayAmount>${amount}</DisplayAmount>
    <CurrencyCode>0949</CurrencyCode>
    <MerchantOrderId>${orderId}</MerchantOrderId>
    <TransactionSecurity>3</TransactionSecurity>
</KuveytTurkVPosMessage>`.trim().replace(/\n/g, '').replace(/>\s+</g, '><');

        const response = await axios.post(process.env.KT_PAYMENT_ADRESS, xmlPayload, {
            headers: { 'Content-Type': 'text/xml; charset=utf-8' }
        });

        res.send(response.data);

    } catch (error) {
        console.error("Hata:", error.response ? error.response.data : error.message);
        res.status(500).send("Banka sunucusu isteği reddetti. Lütfen sunucu üzerindeki XML yapısını kontrol edin.");
    }
});

app.listen(process.env.PORT, () => console.log(`Sunucu aktif: http://localhost:${process.env.PORT}`));