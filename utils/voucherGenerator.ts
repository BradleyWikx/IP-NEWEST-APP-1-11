
import { Voucher } from '../types';
import { formatCurrency } from './formatters';

const LOGO_URL = "https://irp.cdn-website.com/e8046ea7/dms3rep/multi/logo-ip+%281%29.png";

export const generateVoucherHTML = (voucher: Voucher) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${voucher.code}&color=000000&bgcolor=ffffff&margin=10`;

  return `
    <div class="voucher-container" style="
      width: 210mm; 
      height: 297mm; 
      margin: 0 auto; 
      background-color: #0f0202; 
      background-image: radial-gradient(circle at 50% 30%, #4a0404 0%, #0f0202 70%);
      color: white; 
      font-family: 'Playfair Display', serif; 
      position: relative; 
      overflow: hidden;
      print-color-adjust: exact; 
      -webkit-print-color-adjust: exact;
    ">
      
      <!-- Decorative Borders -->
      <div style="
        position: absolute; 
        inset: 15mm; 
        border: 2px solid #b48a3c; 
        border-radius: 4px;
        box-shadow: 0 0 20px rgba(180, 138, 60, 0.3), inset 0 0 20px rgba(180, 138, 60, 0.3);
        z-index: 10;
        pointer-events: none;
      "></div>
      
      <div style="
        position: absolute; 
        inset: 16mm; 
        border: 1px solid #7c5e25; 
        border-radius: 2px;
        opacity: 0.6;
        z-index: 10;
        pointer-events: none;
      "></div>

      <!-- Corner Ornaments (CSS shapes) -->
      <div style="position: absolute; top: 15mm; left: 15mm; width: 30px; height: 30px; border-top: 4px solid #fbbf24; border-left: 4px solid #fbbf24; z-index: 20;"></div>
      <div style="position: absolute; top: 15mm; right: 15mm; width: 30px; height: 30px; border-top: 4px solid #fbbf24; border-right: 4px solid #fbbf24; z-index: 20;"></div>
      <div style="position: absolute; bottom: 15mm; left: 15mm; width: 30px; height: 30px; border-bottom: 4px solid #fbbf24; border-left: 4px solid #fbbf24; z-index: 20;"></div>
      <div style="position: absolute; bottom: 15mm; right: 15mm; width: 30px; height: 30px; border-bottom: 4px solid #fbbf24; border-right: 4px solid #fbbf24; z-index: 20;"></div>

      <!-- Main Content Wrapper -->
      <div style="
        position: relative; 
        z-index: 30; 
        padding: 30mm; 
        height: 100%; 
        box-sizing: border-box; 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        justify-content: space-between;
      ">
        
        <!-- HEADER: LOGO -->
        <div style="text-align: center; margin-bottom: 20px;">
           <img src="${LOGO_URL}" alt="Inspiration Point" style="height: 120px; object-fit: contain; filter: drop-shadow(0 0 10px rgba(251, 191, 36, 0.3));">
           <div style="
             margin-top: 15px; 
             font-family: 'Inter', sans-serif; 
             text-transform: uppercase; 
             letter-spacing: 6px; 
             font-size: 12px; 
             color: #d4a34e;
           ">The Gift of Wonder</div>
        </div>

        <!-- CENTER: TICKET / AMOUNT -->
        <div style="
          width: 100%; 
          text-align: center; 
          border-top: 1px solid rgba(180, 138, 60, 0.3); 
          border-bottom: 1px solid rgba(180, 138, 60, 0.3); 
          padding: 40px 0;
          background: rgba(0,0,0,0.3);
        ">
           <div style="font-family: 'Cinzel', serif; font-size: 24px; color: #e5e5e5; text-transform: uppercase; letter-spacing: 4px; margin-bottom: 20px;">
             Theater Cheque
           </div>
           
           <div style="
             font-size: 100px; 
             line-height: 1; 
             font-weight: 700; 
             color: transparent; 
             background: linear-gradient(to bottom, #fcd34d, #b45309); 
             -webkit-background-clip: text; 
             background-clip: text;
             text-shadow: 0 10px 20px rgba(0,0,0,0.5);
             margin-bottom: 20px;
           ">
              ${formatCurrency(voucher.originalBalance)}
           </div>

           ${voucher.label ? `<div style="font-family: 'Inter', sans-serif; font-size: 14px; color: #9ca3af; text-transform: uppercase; letter-spacing: 2px;">${voucher.label}</div>` : ''}
        </div>

        <!-- DETAILS -->
        <div style="width: 100%; text-align: center; font-family: 'Inter', sans-serif;">
           <p style="font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Aangeboden aan</p>
           <h2 style="font-family: 'Playfair Display', serif; font-size: 32px; color: #fff; margin: 0;">${voucher.issuedTo || 'De Ontvanger'}</h2>
           <p style="margin-top: 20px; font-style: italic; color: #d4d4d4; font-size: 16px; max-width: 80%; margin-left: auto; margin-right: auto; line-height: 1.6;">
             "Laat u meevoeren in een avond vol culinaire magie en onvergetelijk spektakel bij Inspiration Point."
           </p>
        </div>

        <!-- FOOTER: QR & CODE -->
        <div style="
          width: 100%; 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-top: 40px;
          padding-top: 20px;
        ">
           <div style="text-align: left;">
              <div style="font-family: 'Inter', sans-serif; font-size: 10px; text-transform: uppercase; color: #b48a3c; letter-spacing: 2px; margin-bottom: 5px;">Voucher Code</div>
              <div style="
                font-family: 'Courier New', monospace; 
                font-size: 28px; 
                color: #fff; 
                letter-spacing: 3px; 
                font-weight: bold; 
                text-shadow: 0 0 10px rgba(251, 191, 36, 0.3);
              ">${voucher.code}</div>
              <div style="font-family: 'Inter', sans-serif; font-size: 10px; color: #64748b; margin-top: 5px;">Geldig tot 2 jaar na uitgifte</div>
           </div>
           
           <div style="
             padding: 10px; 
             background: #fff; 
             border-radius: 8px; 
             box-shadow: 0 0 15px rgba(0,0,0,0.5);
           ">
              <img src="${qrUrl}" alt="QR Code" style="width: 100px; height: 100px; display: block;">
           </div>
        </div>

      </div>
    </div>
  `;
};

export const printVoucher = (voucher: Voucher) => {
  const content = generateVoucherHTML(voucher);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(`
      <html>
        <head>
          <title>Voucher Printen</title>
          <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Cinzel:wght@400;700&family=Inter:wght@300;400;600&display=swap" rel="stylesheet">
          <style>
            body { margin: 0; padding: 0; background: #222; display: flex; justify-content: center; }
            @media print {
              body { background: none; display: block; }
              @page { size: A4 portrait; margin: 0; }
            }
          </style>
        </head>
        <body>
          ${content}
          <script>
            // Wait for images (logo/qr) to load before printing
            window.onload = () => { setTimeout(() => window.print(), 800); };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }
};
