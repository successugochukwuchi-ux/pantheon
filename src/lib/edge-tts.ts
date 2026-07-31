import crypto from 'crypto';

export interface TTSOptions {
  text: string;
  voice?: string;
  rate?: string;
}

export const MICROSOFT_VOICES = [
  { id: 'en-US-AriaNeural', name: 'Aria (US Female - Natural)', lang: 'en-US', gender: 'Female' },
  { id: 'en-US-GuyNeural', name: 'Guy (US Male - Natural)', lang: 'en-US', gender: 'Male' },
  { id: 'en-US-JennyNeural', name: 'Jenny (US Female - Soft)', lang: 'en-US', gender: 'Female' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia (UK Female - Natural)', lang: 'en-GB', gender: 'Female' },
  { id: 'en-GB-RyanNeural', name: 'Ryan (UK Male - Natural)', lang: 'en-GB', gender: 'Male' },
  { id: 'en-NG-EzinneNeural', name: 'Ezinne (Nigeria Female - Natural)', lang: 'en-NG', gender: 'Female' },
  { id: 'en-NG-AbeoNeural', name: 'Abeo (Nigeria Male - Natural)', lang: 'en-NG', gender: 'Male' },
];

export async function generateEdgeTTS(options: TTSOptions): Promise<Buffer> {
  const voice = options.voice || 'en-US-AriaNeural';
  const rate = options.rate || '0%';
  const text = options.text.trim();

  if (!text) {
    throw new Error('Empty text provided for TTS');
  }

  const escapedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const requestId = crypto.randomBytes(16).toString('hex');
  const wsUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EA63407983578873F4FAF348`;

  return new Promise((resolve, reject) => {
    const audioBuffers: Buffer[] = [];
    const ws = new WebSocket(wsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
        'Origin': 'chrome-extension://jdiccldimpdaibcomobobfl visualised-speech',
      },
    } as any);

    const timeout = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error('Edge TTS synthesis timed out after 15s'));
    }, 15000);

    ws.onopen = () => {
      // 1. Send speech config
      const configMsg = `X-Timestamp:${new Date().toISOString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataversion":"2020-02-07","format":"audio-24khz-48kbitrate-mono-mp3"}}}}`;
      ws.send(configMsg);

      // 2. Send SSML
      const ssmlMsg = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><pitch hertz='0Hz'/><prosody pitch='+0Hz' rate='${rate}' volume='+0%'>${escapedText}</prosody></voice></speak>`;
      ws.send(ssmlMsg);
    };

    ws.onmessage = async (event: MessageEvent) => {
      if (typeof event.data === 'string') {
        if (event.data.includes('Path:turn.end')) {
          clearTimeout(timeout);
          try { ws.close(); } catch {}
          resolve(Buffer.concat(audioBuffers));
        }
      } else if (event.data instanceof ArrayBuffer || Buffer.isBuffer(event.data) || event.data instanceof Blob) {
        let buffer: Buffer;
        if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer();
          buffer = Buffer.from(arrayBuffer);
        } else if (event.data instanceof ArrayBuffer) {
          buffer = Buffer.from(event.data);
        } else {
          buffer = event.data;
        }

        // Look for Path:audio boundary
        const headerDelimiter = 'Path:audio\r\n';
        const delimiterIndex = buffer.indexOf(headerDelimiter);
        if (delimiterIndex !== -1) {
          const audioData = buffer.subarray(delimiterIndex + headerDelimiter.length);
          if (audioData.length > 0) {
            audioBuffers.push(audioData);
          }
        }
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timeout);
      try { ws.close(); } catch {}
      reject(new Error('Edge TTS WebSocket connection error'));
    };

    ws.onclose = () => {
      clearTimeout(timeout);
      if (audioBuffers.length > 0) {
        resolve(Buffer.concat(audioBuffers));
      } else {
        reject(new Error('Edge TTS connection closed without audio output'));
      }
    };
  });
}
