import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

declare var Winwheel: any;

interface WheelSegment {
  text: string;
  fillStyle: string;
  weight?: number; // 比率（重み）
}

interface NewItem {
  text: string;
  color: string;
  weight: number;
}

@Component({
  selector: 'app-roulette',
  imports: [FormsModule],
  templateUrl: './roulette.html',
  styleUrl: './roulette.css'
})
export class Roulette implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('wheelCanvas', { static: false }) wheelCanvas!: ElementRef<HTMLCanvasElement>;
  
  wheel: any;
  canvasId = 'wheelCanvas';
  private baseWheelSize = 400;
  private minWheelSize = 300;
  private maxWheelSize = 800;
  isSpinning = false;
  lastResult: string | null = null;
  lastResultIndex: number = -1;
  
  private audioContext: AudioContext | null = null;
  private clickSound: AudioBuffer | null = null;
  private bellSound: AudioBuffer | null = null;
  private clickInterval: any = null;
  
  segments: WheelSegment[] = [];
  
  newItem: NewItem = {
    text: '',
    color: '#FF6B6B',
    weight: 1
  };

  // 項目一覧の表示制御
  searchTerm = '';
  currentPage = 1;
  itemsPerPage = 10;

  // 現在指している項目
  currentPointingSegment: WheelSegment | null = null;
  private animationFrame: number | null = null;

  // デフォルトカラーパレット
  private defaultColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD',
    '#FF9F43', '#10AC84', '#5F27CD', '#00D2D3', '#FF6348', '#2ED573',
    '#A742FF', '#FF5722', '#8BC34A', '#2196F3', '#FF9800', '#9C27B0',
    '#E91E63', '#795548', '#607D8B', '#FF7043', '#66BB6A', '#42A5F5'
  ];

  // デフォルトセグメント
  private defaultSegments: WheelSegment[] = [
    { text: '選択肢1', fillStyle: '#FF6B6B', weight: 1 },
    { text: '選択肢2', fillStyle: '#4ECDC4', weight: 1 },
    { text: '選択肢3', fillStyle: '#45B7D1', weight: 1 },
    { text: '選択肢4', fillStyle: '#96CEB4', weight: 1 },
    { text: '選択肢5', fillStyle: '#FFEAA7', weight: 1 },
    { text: '選択肢6', fillStyle: '#DDA0DD', weight: 1 }
  ];

  get wheelSize(): number {
    const segmentCount = this.segments.length;
    
    // 項目数に応じてサイズを動的に計算
    if (segmentCount <= 10) {
      return this.baseWheelSize;
    } else if (segmentCount <= 50) {
      return Math.min(this.baseWheelSize + (segmentCount - 10) * 5, this.maxWheelSize);
    } else if (segmentCount <= 200) {
      return Math.min(this.baseWheelSize + 200 + (segmentCount - 50) * 2, this.maxWheelSize);
    } else {
      return this.maxWheelSize;
    }
  }

  get fontSize(): number {
    const segmentCount = this.segments.length;
    
    if (segmentCount <= 10) {
      return 16;
    } else if (segmentCount <= 30) {
      return 14;
    } else if (segmentCount <= 100) {
      return 12;
    } else if (segmentCount <= 300) {
      return 10;
    } else {
      return 8;
    }
  }

  // テキストを適切な長さに省略
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 1) + '…';
  }

  get maxTextLength(): number {
    const segmentCount = this.segments.length;
    
    if (segmentCount <= 10) {
      return 15;
    } else if (segmentCount <= 30) {
      return 12;
    } else if (segmentCount <= 100) {
      return 8;
    } else if (segmentCount <= 300) {
      return 6;
    } else {
      return 4;
    }
  }

  ngOnInit() {
    // Winwheel.jsライブラリのロード確認
    if (typeof Winwheel === 'undefined') {
      console.error('Winwheel library not loaded');
    }
    
    // LocalStorageから設定を読み込み、なければデフォルトを設定
    this.loadFromLocalStorage();
    if (this.segments.length === 0) {
      this.segments = [...this.defaultSegments];
    }
    
    // 項目表示を調整
    this.adjustItemsPerPage();
    
    // オーディオコンテキストを初期化
    this.initializeAudio();
  }

  ngAfterViewInit() {
    this.initializeWheel();
  }

  initializeWheel() {
    // 前回の結果をクリア
    this.lastResult = null;
    this.lastResultIndex = -1;
    
    setTimeout(() => {
      if (typeof Winwheel !== 'undefined') {
        try {
          this.wheel = new Winwheel({
            canvasId: this.canvasId,
            numSegments: this.segments.length,
            outerRadius: (this.wheelSize - 16) / 2 - 5,
            segments: this.segments.map(segment => ({
              ...segment,
              text: this.truncateText(segment.text, this.maxTextLength)
            })),
            textAlignment: 'center',
            textFontSize: this.fontSize,
            textFontFamily: 'Arial',
            textFillStyle: '#000000',
            lineWidth: 2,
            strokeStyle: '#FFFFFF',
            animation: {
              type: 'spinToStop',
              duration: 3,
              spins: 8,
              easing: 'Power3.easeOut',
              callbackFinished: (indicatedSegment: any) => {
                this.onSpinComplete(indicatedSegment);
              }
            }
          });
          console.log('Winwheel initialized successfully');
        } catch (error) {
          console.error('Error initializing Winwheel:', error);
          this.drawFallbackWheel();
        }
      } else {
        console.warn('Winwheel not available, using canvas fallback');
        this.drawFallbackWheel();
      }
    }, 100);
  }

  drawFallbackWheel() {
    this.drawRotatedWheel(this.currentRotation);
  }

  spinWheel() {
    if (this.isSpinning) return;
    
    this.isSpinning = true;
    this.lastResult = null;
    this.lastResultIndex = -1;
    this.currentPointingSegment = null;

    // クリック音の再生を開始
    this.startClickingSounds();

    if (this.wheel && this.wheel.startAnimation) {
      console.log('Starting Winwheel animation');
      // Winwheelアニメーション中も現在指している項目を更新
      this.startTrackingCurrentSegment();
      this.wheel.startAnimation();
    } else {
      console.log('Using fallback animation');
      this.startFallbackAnimation();
    }
  }

  private currentRotation = 0;

  private startFallbackAnimation() {
    const canvas = this.wheelCanvas.nativeElement;
    const randomSpins = 5 + Math.random() * 3; // 5-8回転
    const randomAngle = Math.random() * 360;
    const totalRotation = randomSpins * 360 + randomAngle;
    const duration = 3000; // 3秒
    const startTime = Date.now();
    const startRotation = this.currentRotation;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // イージングアウト関数
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      this.currentRotation = startRotation + totalRotation * easeOut;
      
      // 現在指している項目を更新
      this.updateCurrentPointingSegment();
      
      // Canvasを回転させて描画
      this.drawRotatedWheel(this.currentRotation);
      
      if (progress < 1) {
        this.animationFrame = requestAnimationFrame(animate);
      } else {
        // アニメーション完了、結果を決定
        // まず音を停止
        this.isSpinning = false;
        this.stopClickingSounds();
        
        // 上向きポインターが指すセグメントを計算
        const finalAngle = (this.currentRotation % 360);
        
        // ポインターが指すセグメントのインデックスを計算（比率対応）
        // ルーレットが時計回りに回転するので、逆方向で計算
        let pointerAngle = (360 - finalAngle) % 360;
        if (pointerAngle < 0) pointerAngle += 360;
        
        const resultIndex = this.getSegmentIndexFromAngle(pointerAngle);
        const result = this.segments[resultIndex] || this.segments[0];
        this.lastResultIndex = resultIndex;
        
        // ベルの音を即座に再生
        this.playBellSound();
        
        // 結果を設定
        this.lastResult = result.text;
        
        // 現在指している項目をクリア
        this.currentPointingSegment = null;
        
        // 当選位置マーカー付きで再描画
        setTimeout(() => {
          this.drawWheelWithWinner();
        }, 100);
      }
    };
    
    animate();
  }

  private drawRotatedWheel(rotation: number) {
    const canvas = this.wheelCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = this.wheelSize - 16; // 外枠分を引く
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const radius = canvasSize / 2 - 5;

    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);

    const segmentSizes = this.getSegmentSizes();
    const startAngles = this.getSegmentStartAngles();

    this.segments.forEach((segment, index) => {
      const startAngle = (startAngles[index] * Math.PI) / 180;
      const segmentAngle = (segmentSizes[index] * Math.PI) / 180;
      const endAngle = startAngle + segmentAngle;

      // セグメントを描画
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = segment.fillStyle;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // テキストを描画
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.font = `${this.fontSize}px Arial`;
      const displayText = this.truncateText(segment.text, this.maxTextLength);
      ctx.fillText(displayText, radius / 2, 5);
      ctx.restore();
    });

    ctx.restore();
  }

  private drawWheelWithWinner() {
    const canvas = this.wheelCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const canvasSize = this.wheelSize - 16;
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;
    const radius = canvasSize / 2 - 5;

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    const segmentSizes = this.getSegmentSizes();
    const startAngles = this.getSegmentStartAngles();

    // ルーレットセグメントを描画
    this.segments.forEach((segment, index) => {
      const startAngle = (startAngles[index] * Math.PI) / 180 + (this.currentRotation * Math.PI) / 180;
      const segmentAngle = (segmentSizes[index] * Math.PI) / 180;
      const endAngle = startAngle + segmentAngle;

      // セグメントを描画
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      
      // 当選セグメントの場合は特別な効果
      if (index === this.lastResultIndex) {
        // グラデーション効果
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, segment.fillStyle);
        gradient.addColorStop(0.7, segment.fillStyle);
        gradient.addColorStop(1, '#FFD700'); // 金色の光り
        ctx.fillStyle = gradient;
        
        // 境界線を太く
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 4;
      } else {
        ctx.fillStyle = segment.fillStyle;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
      }
      
      ctx.fill();
      ctx.stroke();

      // テキストを描画
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = index === this.lastResultIndex ? '#000000' : '#000000';
      const isWinner = index === this.lastResultIndex;
      const adjustedFontSize = isWinner ? Math.min(this.fontSize + 2, 18) : this.fontSize;
      ctx.font = isWinner ? `bold ${adjustedFontSize}px Arial` : `${adjustedFontSize}px Arial`;
      const displayText = this.truncateText(segment.text, this.maxTextLength);
      ctx.fillText(displayText, radius / 2, 5);
      ctx.restore();
    });

    // 当選セグメントに星印を追加
    if (this.lastResultIndex >= 0) {
      const winnerStartAngle = (startAngles[this.lastResultIndex] * Math.PI) / 180;
      const winnerSegmentAngle = (segmentSizes[this.lastResultIndex] * Math.PI) / 180;
      const winnerAngle = winnerStartAngle + winnerSegmentAngle / 2 + (this.currentRotation * Math.PI) / 180;
      const starX = centerX + Math.cos(winnerAngle) * (radius * 0.75);
      const starY = centerY + Math.sin(winnerAngle) * (radius * 0.75);
      
      ctx.save();
      ctx.translate(starX, starY);
      
      // 星を描画
      this.drawStar(ctx, 0, 0, 5, 12, 6);
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#FF6B6B';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    }
  }

  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
  }

  // 現在指している項目を更新（右側ポインター基準）
  private updateCurrentPointingSegment() {
    // 右側ポインター（3時方向）が指すセグメントを計算
    // ルーレットが時計回りに回転するので、ポインターの逆方向を計算
    const currentAngle = (360 - (this.currentRotation % 360)) % 360;
    
    // セグメントインデックスを取得
    const segmentIndex = this.getSegmentIndexFromAngle(currentAngle);
    this.currentPointingSegment = this.segments[segmentIndex] || null;
  }

  onSpinComplete(indicatedSegment: any) {
    // Winwheelライブラリ使用時のコールバック
    this.isSpinning = false;
    this.lastResult = indicatedSegment.text;
    
    // クリック音を停止
    this.stopClickingSounds();
    
    // 鐘の音を再生
    this.playBellSound();
    
    // 当選セグメントのインデックスを取得
    this.lastResultIndex = this.segments.findIndex(segment => segment.text === indicatedSegment.text);
    
    // 現在指している項目をクリア
    this.currentPointingSegment = null;
    
    // 当選位置マーカー付きで再描画
    setTimeout(() => {
      this.drawWheelWithWinner();
    }, 100);
  }

  addItem() {
    if (this.newItem.text.trim()) {
      this.segments.push({
        text: this.newItem.text.trim(),
        fillStyle: this.newItem.color,
        weight: this.newItem.weight
      });
      
      this.newItem.text = '';
      this.newItem.color = '#FF6B6B';
      this.newItem.weight = 1;
      
      this.adjustItemsPerPage();
      this.saveToLocalStorage();
      this.initializeWheel();
    }
  }

  // 比率に基づいてセグメントサイズを計算
  private getSegmentSizes(): number[] {
    const totalWeight = this.segments.reduce((sum, segment) => sum + (segment.weight || 1), 0);
    return this.segments.map(segment => ((segment.weight || 1) / totalWeight) * 360);
  }

  // セグメントの開始角度を計算
  private getSegmentStartAngles(): number[] {
    const sizes = this.getSegmentSizes();
    const startAngles: number[] = [];
    let currentAngle = 0;
    
    for (let i = 0; i < sizes.length; i++) {
      startAngles.push(currentAngle);
      currentAngle += sizes[i];
    }
    
    return startAngles;
  }

  // 角度からセグメントインデックスを取得
  private getSegmentIndexFromAngle(angle: number): number {
    const normalizedAngle = ((angle % 360) + 360) % 360;
    const startAngles = this.getSegmentStartAngles();
    const sizes = this.getSegmentSizes();
    
    for (let i = 0; i < this.segments.length; i++) {
      const endAngle = (startAngles[i] + sizes[i]) % 360;
      
      if (startAngles[i] <= endAngle) {
        if (normalizedAngle >= startAngles[i] && normalizedAngle < endAngle) {
          return i;
        }
      } else {
        // セグメントが360度をまたぐ場合
        if (normalizedAngle >= startAngles[i] || normalizedAngle < endAngle) {
          return i;
        }
      }
    }
    
    return 0;
  }

  removeItem(item: WheelSegment) {
    const index = this.segments.indexOf(item);
    if (index > -1) {
      this.segments.splice(index, 1);
      this.adjustItemsPerPage();
      this.saveToLocalStorage();
      this.initializeWheel();
    }
  }

  private saveToLocalStorage() {
    try {
      localStorage.setItem('webwheel-segments', JSON.stringify(this.segments));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  private loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem('webwheel-segments');
      if (saved) {
        const parsedSegments = JSON.parse(saved);
        if (Array.isArray(parsedSegments) && parsedSegments.length > 0) {
          this.segments = parsedSegments;
        }
      }
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
    }
  }

  private initializeAudio() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.generateClickSound();
      this.generateBellSound();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  private generateClickSound() {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 0.1; // 0.1秒の短いクリック音
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // カチッというクリック音を生成
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      // 短い減衰する高周波音でクリック音を作成
      const frequency = 800;
      const envelope = Math.exp(-t * 50); // 急速に減衰
      const noise = (Math.random() - 0.5) * 0.1;
      
      data[i] = (Math.sin(2 * Math.PI * frequency * t) * envelope + noise) * 0.3;
    }

    this.clickSound = buffer;
  }

  private generateBellSound() {
    if (!this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    const duration = 2; // 2秒の鐘の音
    const buffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    // 鐘の音を生成（複数の周波数の重ね合わせ）
    for (let i = 0; i < buffer.length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 1.5); // ゆっくりと減衰
      
      // 基音と倍音を重ね合わせて鐘のような音を作成
      const fundamental = Math.sin(2 * Math.PI * 523 * t); // C5
      const harmonic2 = Math.sin(2 * Math.PI * 659 * t) * 0.8; // E5
      const harmonic3 = Math.sin(2 * Math.PI * 784 * t) * 0.6; // G5
      const harmonic4 = Math.sin(2 * Math.PI * 1047 * t) * 0.4; // C6
      
      data[i] = (fundamental + harmonic2 + harmonic3 + harmonic4) * envelope * 0.2;
    }

    this.bellSound = buffer;
  }

  private playClickSound() {
    if (!this.audioContext || !this.clickSound) return;

    try {
      // ユーザーインタラクション後にAudioContextを再開
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = this.clickSound;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.warn('Failed to play click sound:', error);
    }
  }

  private playBellSound() {
    if (!this.audioContext || !this.bellSound) return;

    try {
      // ユーザーインタラクション後にAudioContextを再開
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = this.bellSound;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.warn('Failed to play bell sound:', error);
    }
  }

  private startClickingSounds() {
    if (this.clickInterval) {
      clearInterval(this.clickInterval);
    }

    // 最初は速いクリック音から始まって徐々に遅くする
    let clickSpeed = 50; // 初期間隔（ミリ秒）
    const maxSpeed = 300; // 最大間隔（ミリ秒）
    const acceleration = 1.05; // 減速率

    const playClick = () => {
      // スピンが停止したらクリック音も停止
      if (!this.isSpinning) {
        if (this.clickInterval) {
          clearTimeout(this.clickInterval);
          this.clickInterval = null;
        }
        return;
      }

      this.playClickSound();
      
      // 徐々に間隔を長くする（減速効果）
      clickSpeed = Math.min(clickSpeed * acceleration, maxSpeed);
      
      // 次のクリック音をスケジュール
      this.clickInterval = setTimeout(playClick, clickSpeed);
    };

    // 最初のクリック音を再生
    playClick();
  }

  private stopClickingSounds() {
    if (this.clickInterval) {
      clearTimeout(this.clickInterval);
      this.clickInterval = null;
    }
  }

  getMarkerPosition(): { x: number, y: number } {
    if (this.lastResultIndex < 0) {
      return { x: 0, y: 0 };
    }

    // コンテナ全体のサイズ（外枠を含む）
    const containerSize = this.wheelSize;
    const centerX = containerSize / 2;
    const centerY = containerSize / 2;
    const radius = containerSize / 2 - 40; // マーカーをCanvas外側に配置
    
    // 比率に基づいたセグメントの角度を計算
    const segmentSizes = this.getSegmentSizes();
    const startAngles = this.getSegmentStartAngles();
    
    // 当選セグメントの中心角度を計算
    const segmentCenterAngle = startAngles[this.lastResultIndex] + segmentSizes[this.lastResultIndex] / 2;
    
    // 現在のルーレット回転を考慮し、右側ポインター（3時方向）基準で計算
    // 3時方向基準なので90度オフセットを追加
    const actualAngle = (segmentCenterAngle + this.currentRotation + 90) % 360;
    
    // ラジアンに変換（3時方向が0度、時計回り）
    const angleInRadians = (actualAngle * Math.PI) / 180;
    
    // マーカーの位置を計算（3時方向が0度の座標系）
    const x = centerX + Math.cos(angleInRadians) * radius;
    const y = centerY + Math.sin(angleInRadians) * radius;
    
    return { x, y };
  }

  getMarkerRotation(): number {
    if (this.lastResultIndex < 0) {
      return 0;
    }

    // 比率に基づいたセグメントの角度を計算
    const segmentSizes = this.getSegmentSizes();
    const startAngles = this.getSegmentStartAngles();
    const segmentCenterAngle = startAngles[this.lastResultIndex] + segmentSizes[this.lastResultIndex] / 2;
    
    // 右側ポインター基準で角度を計算
    const actualAngle = (segmentCenterAngle + this.currentRotation + 90) % 360;
    
    // マーカー（◀）が中心を向くように回転
    // ◀は左向きなので、中心に向けるために180度回転
    return (actualAngle + 180) % 360;
  }

  onWeightChange() {
    // 比率変更時にルーレットを再描画
    this.saveToLocalStorage();
    this.initializeWheel();
  }

  getSegmentPercentage(segment: WheelSegment): string {
    const totalWeight = this.segments.reduce((sum, seg) => sum + (seg.weight || 1), 0);
    const percentage = ((segment.weight || 1) / totalWeight) * 100;
    return percentage.toFixed(1);
  }

  onCsvFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const csvContent = e.target.result;
      this.parseCsvAndUpdateSegments(csvContent);
    };
    reader.readAsText(file);
  }

  private parseCsvAndUpdateSegments(csvContent: string) {
    try {
      const lines = csvContent.split('\n').filter(line => line.trim());
      const newSegments: WheelSegment[] = [];
      
      lines.forEach((line, index) => {
        const columns = this.parseCsvLine(line);
        if (columns.length === 0) return;

        const name = columns[0]?.trim();
        if (!name) return;

        // 比率を解析（デフォルト: 1）
        let weight = 1;
        if (columns.length > 1 && columns[1]?.trim()) {
          const parsedWeight = parseFloat(columns[1].trim());
          if (!isNaN(parsedWeight) && parsedWeight > 0) {
            weight = parsedWeight;
          }
        }

        // カラーを解析（デフォルト: パレットから自動選択）
        let color = this.defaultColors[index % this.defaultColors.length];
        if (columns.length > 2 && columns[2]?.trim()) {
          const specifiedColor = columns[2].trim();
          // #で始まるか、有効なカラー名かチェック
          if (this.isValidColor(specifiedColor)) {
            color = specifiedColor;
          }
        }

        newSegments.push({
          text: name,
          fillStyle: color,
          weight: weight
        });
      });

      if (newSegments.length > 0) {
        this.segments = newSegments;
        this.adjustItemsPerPage();
        this.saveToLocalStorage();
        this.initializeWheel();
        console.log(`CSV読み込み完了: ${newSegments.length}個の項目を追加しました`);
      } else {
        alert('有効なデータが見つかりませんでした。CSV形式を確認してください。');
      }
    } catch (error) {
      console.error('CSV解析エラー:', error);
      alert('CSVファイルの解析に失敗しました。ファイル形式を確認してください。');
    }
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }

  private isValidColor(color: string): boolean {
    // #で始まる16進数カラーかチェック
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(hex);
    }
    
    // CSSカラー名かチェック（簡易版）
    const namedColors = [
      'red', 'green', 'blue', 'yellow', 'orange', 'purple', 'pink', 'brown',
      'black', 'white', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'navy',
      'maroon', 'olive', 'aqua', 'silver', 'teal', 'fuchsia'
    ];
    
    return namedColors.includes(color.toLowerCase());
  }

  exportToCsv() {
    const csvContent = this.segments.map(segment => {
      const name = `"${segment.text.replace(/"/g, '""')}"`;
      const weight = segment.weight || 1;
      const color = segment.fillStyle;
      return `${name},${weight},${color}`;
    }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'roulette_settings.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // フィルタリングされた項目を取得
  get filteredSegments(): WheelSegment[] {
    if (!this.searchTerm) {
      return this.segments;
    }
    return this.segments.filter(segment => 
      segment.text.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  // ページネーション用の項目を取得
  get paginatedSegments(): WheelSegment[] {
    const filtered = this.filteredSegments;
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  }

  // 総ページ数を計算
  get totalPages(): number {
    return Math.ceil(this.filteredSegments.length / this.itemsPerPage);
  }

  // ページ変更
  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  // 検索リセット
  resetSearch() {
    this.searchTerm = '';
    this.currentPage = 1;
  }

  // 項目表示を動的に調整
  adjustItemsPerPage() {
    if (this.segments.length <= 20) {
      this.itemsPerPage = 10;
    } else if (this.segments.length <= 100) {
      this.itemsPerPage = 20;
    } else {
      this.itemsPerPage = 50;
    }
    this.currentPage = 1;
  }

  // ページネーション表示用のページ配列を生成
  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  // 現在の表示範囲を取得
  get displayRange(): string {
    const start = (this.currentPage - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage * this.itemsPerPage, this.filteredSegments.length);
    const total = this.filteredSegments.length;
    return `${start} - ${end} / ${total} 件を表示`;
  }

  // 当選セグメントの色を取得
  getWinnerSegmentColor(): string {
    if (this.lastResultIndex >= 0 && this.lastResultIndex < this.segments.length) {
      return this.segments[this.lastResultIndex].fillStyle;
    }
    return '#4ECDC4'; // デフォルト色
  }

  // Winwheel使用時の追跡
  private startTrackingCurrentSegment() {
    const trackSegment = () => {
      if (!this.isSpinning) {
        return;
      }
      
      if (this.wheel && this.wheel.rotationAngle !== undefined) {
        this.currentRotation = this.wheel.rotationAngle;
        this.updateCurrentPointingSegment();
      }
      
      this.animationFrame = requestAnimationFrame(trackSegment);
    };
    
    trackSegment();
  }

  // デフォルトに戻す
  resetToDefault() {
    if (this.isSpinning) return;
    
    this.segments = [...this.defaultSegments];
    this.lastResult = null;
    this.lastResultIndex = -1;
    this.currentPointingSegment = null;
    this.adjustItemsPerPage();
    this.saveToLocalStorage();
    this.initializeWheel();
  }

  // 当選者を除外
  excludeWinner() {
    if (this.isSpinning || this.lastResultIndex < 0 || this.segments.length <= 1) return;
    
    const winnerName = this.segments[this.lastResultIndex].text;
    
    // 当選者を除外
    this.segments.splice(this.lastResultIndex, 1);
    
    // 結果をクリア
    this.lastResult = null;
    this.lastResultIndex = -1;
    this.currentPointingSegment = null;
    
    this.adjustItemsPerPage();
    this.saveToLocalStorage();
    this.initializeWheel();
    
    // フィードバック
    alert(`「${winnerName}」を除外しました。`);
  }

  // 全削除の確認
  confirmAndClearAll() {
    if (this.isSpinning) return;
    
    const confirmed = confirm('全ての項目を削除してデフォルトに戻しますか？\nこの操作は取り消せません。');
    if (confirmed) {
      this.resetToDefault();
    }
  }

  // 全て削除（内部用）
  private clearAllItems() {
    this.segments = [];
    this.lastResult = null;
    this.lastResultIndex = -1;
    this.currentPointingSegment = null;
    this.adjustItemsPerPage();
    this.saveToLocalStorage();
    this.initializeWheel();
  }

  ngOnDestroy() {
    // クリック音のインターバルをクリーンアップ
    this.stopClickingSounds();
    
    // アニメーションフレームをクリーンアップ
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }
  }
}
