import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { TelegramConfig } from '../types';

export async function getTelegramConfig(): Promise<TelegramConfig | null> {
  try {
    const docRef = doc(db, 'system', 'telegram');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as TelegramConfig;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch Telegram config:", error);
    return null;
  }
}

export async function sendTelegramAlert(message: string) {
  const config = await getTelegramConfig();
  if (!config || !config.isActive || !config.botToken || !config.chatId) {
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        parse_mode: 'HTML'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Telegram API Error:", errorData);
    }
  } catch (error) {
    console.error("Failed to send Telegram alert:", error);
  }
}

export async function testTelegramConnection(botToken: string, chatId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: `<b>PANTHEON SYSTEM TEST</b>\n\n✅ Telegram integration is working correctly!`,
        parse_mode: 'HTML'
      }),
    });

    if (response.ok) {
      return { success: true };
    } else {
      const errorData = await response.json();
      return { success: false, error: errorData.description || 'Unknown error' };
    }
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}
