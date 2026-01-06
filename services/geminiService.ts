
import { GoogleGenAI } from "@google/genai";
import { Transaction } from "../types";

// Always use the API key directly from process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const analyzeFinances = async (transactions: Transaction[]) => {
  try {
    const dataSummary = transactions.map(t => ({
      date: t.date,
      fund: t.fundType,
      type: t.type,
      amount: t.amount,
      desc: t.description
    }));

    const prompt = `
      Dưới đây là danh sách các giao dịch tài chính (Công đoàn, Đảng phí, Văn phòng):
      ${JSON.stringify(dataSummary)}

      Hãy phân tích dữ liệu này và cung cấp:
      1. Tóm tắt ngắn gọn tình hình thu chi của từng quỹ.
      2. Cảnh báo nếu có chi tiêu bất thường hoặc vượt ngân sách (nếu có thể suy luận).
      3. Đưa ra 3 lời khuyên tối ưu hóa ngân sách cho đơn vị.
      4. Dự báo xu hướng tháng tới.

      Trả lời bằng tiếng Việt, định dạng Markdown chuyên nghiệp.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "Rất tiếc, AI không thể phân tích dữ liệu vào lúc này. Vui lòng thử lại sau.";
  }
};
