/**
 * ============================================================================
 * SUPERNOVA — CENTRAL API ROUTER DIRECTORY
 * File: /server/routes/index.ts
 * ============================================================================
 * 
 * 📢 สารบัญการพัฒนาต่อยอด (DEVELOPER ARCHITECTURE GUIDE):
 * 
 * หากท่านต้องการพัฒนาหรือเพิ่ม API เส้นใหม่ กรุณาเลือกไฟล์ให้ตรงตามประเภทของระบบ:
 * 
 * 1. 💳 ระบบกระเป๋าเงิน และ Webhook ธนาคาร (Seamless Wallet / Banking / Webhooks):
 *    -> แก้ไข/เพิ่มในไฟล์: `/server/routes/walletRoutes.ts`
 *    -> ตัวอย่าง: เพิ่มช่องทางฝาก-ถอนใหม่, ระบบ Cashback, ปรับปรุง Idempotency
 * 
 * 2. 📖 เอกสาร API และ Postman Collection (Postman Suite & OpenAPI Spec):
 *    -> แก้ไข/เพิ่มในไฟล์: `/server/routes/docsRoutes.ts`
 *    -> ตัวอย่าง: เพิ่ม Endpoint เข้า Postman JSON อัตโนมัติ, เพิ่ม Schema
 * 
 * 3. 🚀 ตัวเกมและ Provably Fair (Game Engine, History, JWT Player Sessions):
 *    -> ตัวจัดการอยู่ใน: `/server.ts` และสามารถแยกมาลงใน Router นี้ได้
 * 
 * 4. 📊 ระบบความเสี่ยงและการันตี RTP (Actuarial Risk Engine & Liability Ceiling):
 *    -> ตัวจัดการอยู่ใน: `/server.ts` และ `/server/riskAssuranceEngine.ts`
 * 
 * 5. 🏢 ระบบ B2B และ Distributed Cache (Redis, Partitioned Logs, K6 Stress Test):
 *    -> ตัวจัดการอยู่ใน: `/server/b2bArchitectureEngine.ts` และ `/server/k6MasterEngine.ts`
 * 
 * ============================================================================
 */

import { Router } from "express";
import { walletRouter } from "./walletRoutes.js";
import { docsRouter } from "./docsRoutes.js";

export const apiRouter = Router();

// Mount modular sub-routers
apiRouter.use("/v1/wallet", walletRouter);
apiRouter.use("/wallet/v1", walletRouter); // Alias for B2B standard path
apiRouter.use("/docs", docsRouter);

export default apiRouter;
