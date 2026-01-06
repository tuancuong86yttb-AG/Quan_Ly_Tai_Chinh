
import { Transaction } from "../types";

/**
 * Hướng dẫn thiết lập Google Sheets:
 * 1. Mở file Google Sheet của bạn.
 * 2. Vào Tiện ích mở rộng > Apps Script.
 * 3. Dán đoạn code sau:
 * 
 * function doPost(e) {
 *   var data = JSON.parse(e.postData.contents);
 *   var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
 *   sheet.clear();
 *   sheet.appendRow(["ID", "Ngày", "Nội dung", "Quỹ", "Đối tượng", "Loại", "Số tiền"]);
 *   data.forEach(function(t) {
 *     sheet.appendRow([t.id, t.date, t.description, t.fundType, t.person, t.type, t.amount]);
 *   });
 *   return ContentService.createTextOutput(JSON.stringify({status: "ok"})).setMimeType(ContentService.MimeType.JSON);
 * }
 * 
 * function doGet() {
 *   return ContentService.createTextOutput("API is running").setMimeType(ContentService.MimeType.TEXT);
 * }
 * 
 * 4. Nhấn "Triển khai" > "Triển khai mới" > "Ứng dụng web".
 * 5. Chọn "Người truy cập: Bất kỳ ai" (Anyone).
 * 6. Copy URL nhận được và dán vào phần Cài đặt trong ứng dụng.
 */

export const syncToSheet = async (url: string, transactions: Transaction[]) => {
  if (!url || !url.startsWith('https://script.google.com')) return false;

  try {
    const response = await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Apps Script yêu cầu no-cors hoặc xử lý redirect đặc biệt
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(transactions),
    });
    
    // Lưu ý: Với no-cors, chúng ta không đọc được body phản hồi nhưng request vẫn đi
    return true;
  } catch (error) {
    console.error("Sheet Sync Error:", error);
    return false;
  }
};
