/**
 * Sub_Sudoku Web Audio 原生音效合成模組
 * 純前端原生 Web Audio API，無需外掛大型音檔，極致輕量與即時反應
 */

const STORAGE_SOUND_KEY = 'sub_sudoku_sound_enabled';

class SoundEffects {
  constructor() {
    this.ctx = null;
    // 預設開啟音效
    const saved = localStorage.getItem(STORAGE_SOUND_KEY);
    this.enabled = saved !== null ? saved === 'true' : true;
    
    // 1-9 數字對應之自然音階頻率 (C4 ~ D5)
    this.noteFrequencies = {
      1: 261.63, // C4
      2: 293.66, // D4
      3: 329.63, // E4
      4: 349.23, // F4
      5: 392.00, // G4
      6: 440.00, // A4
      7: 493.88, // B4
      8: 523.25, // C5
      9: 587.33  // D5
    };
  }

  // 延遲初始化 AudioContext 以符合瀏覽器自動播放安全原則
  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 切換音效開關
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem(STORAGE_SOUND_KEY, this.enabled.toString());
    if (this.enabled) {
      this.initContext();
      this.playTone(523.25, 0.15, 'sine', 0.15); // 播放開啟短音提示
    }
    return this.enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  // 基礎泛音音符產生器（基音 + 泛音混音，模擬鋼琴/晶透敲擊樂器）
  playTone(freq, duration = 0.2, type = 'sine', volume = 0.25) {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      
      // 主基音振盪器
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = type;
      osc1.frequency.setValueAtTime(freq, now);

      // 副諧波振盪器 (Triangle 增加鋼琴泛音厚度)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(freq * 2, now); // 2次諧波

      // 主音量包絡 (ADSR Envelope: 瞬發打擊 + 指數衰減)
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.linearRampToValueAtTime(volume, now + 0.008);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // 泛音音量包絡 (衰減更快，產生清脆擊弦感)
      gain2.gain.setValueAtTime(0.0001, now);
      gain2.gain.linearRampToValueAtTime(volume * 0.35, now + 0.005);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.6);

      // 節點串接
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);

      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);

      // 啟動與自動停止釋放
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration + 0.05);
      osc2.stop(now + duration + 0.05);
    } catch (err) {
      console.warn('Web Audio 播放受限:', err);
    }
  }

  // 1. 數字填入音階 (1~9)
  playNumber(num) {
    const freq = this.noteFrequencies[num];
    if (freq) {
      this.playTone(freq, 0.28, 'sine', 0.22);
    }
  }

  // 2. 擦除音效 (柔和輕巧的短促回彈音)
  playErase() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.09);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (err) {
      console.warn('Web Audio 播放受限:', err);
    }
  }

  // 3. 填錯警告音效 (柔和雙低音，提醒而不刺耳)
  playError() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.setValueAtTime(130, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (err) {
      console.warn('Web Audio 播放受限:', err);
    }
  }

  // 4. 行/列/九宮格湊齊完成之晶瑩琶音 (Arpeggio Chord)
  playLineComplete() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    // 清亮向上琶音 (G4 -> C5 -> E5 -> G5)
    const notes = [392.00, 523.25, 659.25, 783.99];
    const stepDuration = 0.055;

    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.enabled || !this.ctx) return;
        try {
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = idx === notes.length - 1 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          const vol = idx === notes.length - 1 ? 0.28 : 0.2;
          const decay = idx === notes.length - 1 ? 0.45 : 0.25;

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(vol, now + 0.006);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + decay + 0.05);
        } catch (e) {}
      }, idx * stepDuration * 1000);
    });
  }

  // 5. 全盤破關勝利之盛大琶音交響
  playWin() {
    if (!this.enabled) return;
    this.initContext();
    if (!this.ctx) return;

    // 勝利大調琶音 (C4, E4, G4, C5, E5, G5, C6)
    const winNotes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    const stepTime = 0.07;

    winNotes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.enabled || !this.ctx) return;
        try {
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const oscHarmonic = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          oscHarmonic.type = 'triangle';
          oscHarmonic.frequency.setValueAtTime(freq * 1.5, now);

          const isLast = idx === winNotes.length - 1;
          const vol = isLast ? 0.35 : 0.24;
          const duration = isLast ? 0.9 : 0.35;

          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(vol, now + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

          osc.connect(gain);
          oscHarmonic.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          oscHarmonic.start(now);
          osc.stop(now + duration + 0.05);
          oscHarmonic.stop(now + duration + 0.05);
        } catch (e) {}
      }, idx * stepTime * 1000);
    });
  }
}

export const soundManager = new SoundEffects();
