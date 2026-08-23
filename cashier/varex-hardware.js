(function(){
  "use strict";

  const DEFAULTS={
    printerTransport:"browser",
    printerAddress:"",
    printerPort:9100,
    paperWidth:"80",
    autoPrint:true,
    openDrawerOnCash:true,
    barcodeScannerEnabled:true
  };

  function settings(){
    try{return{...DEFAULTS,...(window.VAREX?.getSettings?.()||{})}}catch(e){return{...DEFAULTS}}
  }

  function nativePlugin(){
    if(!window.__varexNativeHardware&&window.Capacitor?.registerPlugin){
      try{window.__varexNativeHardware=window.Capacitor.registerPlugin("VarexHardware")}catch(e){}
    }
    return window.__varexNativeHardware||window.Capacitor?.Plugins?.VarexHardware||null;
  }

  function isNativePrinterReady(){
    const s=settings();
    return Boolean(nativePlugin()&&s.printerTransport!=="browser"&&s.printerAddress);
  }

  function money(value,currency){
    const number=Number(value||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
    return number+" "+(currency||"AED");
  }

  function asDate(value){
    const date=new Date(value||Date.now());
    return Number.isNaN(date.getTime())?new Date():date;
  }

  function splitText(context,text,maxWidth){
    const words=String(text||"").trim().split(/\s+/).filter(Boolean),lines=[];
    let line="";
    for(const word of words){
      const candidate=line?line+" "+word:word;
      if(line&&context.measureText(candidate).width>maxWidth){lines.push(line);line=word}else line=candidate;
    }
    if(line)lines.push(line);
    return lines.length?lines:[""];
  }

  function makeReceiptCanvas(sale,overrides={}){
    const s={...settings(),...overrides},width=String(s.paperWidth)==="58"?384:576,padding=24;
    const canvas=document.createElement("canvas"),measure=canvas.getContext("2d");
    canvas.width=width;measure.font="24px Tahoma, Arial, sans-serif";
    const items=Array.isArray(sale.items)?sale.items:[];
    const policyLines=splitText(measure,s.returnPolicy||"الاسترجاع والاستبدال حسب سياسة المتجر وبإبراز الفاتورة الأصلية.",width-padding*2);
    const messageLines=splitText(measure,s.invoiceMessage||"شكراً لتسوقكم معنا",width-padding*2);
    const dynamicHeight=650+items.reduce((sum,item)=>sum+58+splitText(measure,item.name,width-padding*2).length*8,0)+(policyLines.length+messageLines.length)*32;
    canvas.height=Math.max(900,dynamicHeight);
    const ctx=canvas.getContext("2d");
    ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#000";ctx.direction="rtl";ctx.textBaseline="top";
    let y=24;
    const font=(size,weight="400")=>{ctx.font=`${weight} ${size}px Tahoma, Arial, sans-serif`};
    const center=(text,size=24,weight="400")=>{font(size,weight);ctx.textAlign="center";ctx.fillText(String(text||""),width/2,y);y+=size+12};
    const line=()=>{ctx.strokeStyle="#111";ctx.setLineDash([8,6]);ctx.beginPath();ctx.moveTo(padding,y);ctx.lineTo(width-padding,y);ctx.stroke();ctx.setLineDash([]);y+=16};
    const row=(right,left,size=22,weight="400")=>{font(size,weight);ctx.textAlign="right";ctx.fillText(String(right||""),width-padding,y);ctx.textAlign="left";ctx.fillText(String(left||""),padding,y);y+=size+12};
    const wrapCenter=(text,size=21,weight="400")=>{font(size,weight);for(const part of splitText(ctx,text,width-padding*2)){ctx.textAlign="center";ctx.fillText(part,width/2,y);y+=size+9}};

    center(s.businessName||"اسم المنشأة",32,"700");
    center((sale.branchName||s.branchName||"الفرع الرئيسي")+(sale.branchCode?" — "+sale.branchCode:""),23,"700");
    if(s.address)wrapCenter(s.address,19);
    if(s.phone)center("هاتف: "+s.phone,19);
    if(s.showTRN!==false&&s.trn)center("TRN: "+s.trn,20,"700");
    center(s.taxEnabled===false?"فاتورة مبيعات / Sales Receipt":"فاتورة ضريبية مبسطة / Simplified Tax Invoice",21,"700");
    line();
    const date=asDate(sale.createdAt||sale.date);
    row("رقم الفاتورة / Invoice",sale.invoiceNumber||"—",20,"700");
    row("التاريخ / Date",date.toLocaleDateString("en-GB"),20);
    row("الوقت / Time",date.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"}),20);
    row("الكاشير / Cashier",sale.cashierName||"—",20);
    row("العميل / Customer",sale.customerName||"عميل نقدي",20);
    line();
    row("الصنف / Item","الإجمالي / Total",20,"700");
    for(const item of items){
      font(21,"700");ctx.textAlign="right";
      for(const part of splitText(ctx,item.name,width-padding*2)){ctx.fillText(part,width-padding,y);y+=28}
      row(`${Number(item.quantity||1)} × ${money(item.price,s.currency||"AED")}`,money(Number(item.price||0)*Number(item.quantity||0),s.currency||"AED"),19);
    }
    line();
    row("المجموع الفرعي / Subtotal",money(sale.subtotal,s.currency||"AED"),21);
    if(Number(sale.discount||0)>0)row("الخصم / Discount",money(sale.discount,s.currency||"AED"),21);
    if(s.taxEnabled!==false){
      const vatLabel=`VAT ${Number(s.taxRate||5)}%${s.taxIncluded!==false?" (مشمولة / Included)":""}`;
      row(vatLabel,money(sale.tax,s.currency||"AED"),21);
    }
    row("الإجمالي / TOTAL",money(sale.total,s.currency||"AED"),27,"700");
    row("طريقة الدفع / Payment",sale.paymentMethod||"—",20);
    row("المدفوع / Paid",money(sale.paid,s.currency||"AED"),20);
    const balance=Number(sale.change||0)>0?Number(sale.change):Number(sale.due||0);
    row(Number(sale.change||0)>0?"الباقي / Change":"المتبقي / Due",money(balance,s.currency||"AED"),20);
    line();
    wrapCenter(s.invoiceMessage||"شكراً لتسوقكم معنا",20,"700");
    y+=5;wrapCenter(s.returnPolicy||"الاسترجاع والاستبدال حسب سياسة المتجر وبإبراز الفاتورة الأصلية.",18);
    y+=8;center("Powered by VAREX",18,"700");center("BUSINESS MANAGEMENT SYSTEM",15);

    const output=document.createElement("canvas");output.width=width;output.height=Math.min(canvas.height,y+12);
    output.getContext("2d").drawImage(canvas,0,0,width,output.height,0,0,width,output.height);
    return output;
  }

  async function listPairedPrinters(){
    const plugin=nativePlugin();
    if(!plugin?.listPairedPrinters)throw new Error("قائمة طابعات البلوتوث متاحة داخل تطبيق VAREX على أندرويد فقط.");
    const result=await plugin.listPairedPrinters();
    return Array.isArray(result?.printers)?result.printers:[];
  }

  async function printSale(sale,options={}){
    const s={...settings(),...options},plugin=nativePlugin();
    if(plugin?.printReceipt&&s.printerTransport!=="browser"&&s.printerAddress){
      const canvas=makeReceiptCanvas(sale,s),imageBase64=canvas.toDataURL("image/png").split(",")[1];
      const result=await plugin.printReceipt({
        transport:s.printerTransport,
        address:String(s.printerAddress||""),
        port:Number(s.printerPort||9100),
        paperWidth:String(s.paperWidth||"80"),
        imageBase64,
        openDrawer:Boolean(options.openDrawer)
      });
      return{success:true,mode:"native",...result};
    }
    if(typeof options.prepareBrowserReceipt==="function")options.prepareBrowserReceipt();
    window.print();
    return{success:true,mode:"browser"};
  }

  async function testPrinter(overrides={}){
    const now=new Date(),sale={invoiceNumber:"TEST-"+String(Date.now()).slice(-6),createdAt:now,branchName:"اختبار الطابعة",cashierName:"VAREX",customerName:"اختبار",paymentMethod:"اختبار",items:[{name:"اختبار طباعة VAREX",quantity:1,price:0}],subtotal:0,discount:0,tax:0,total:0,paid:0,due:0,change:0};
    return printSale(sale,{...overrides,openDrawer:false});
  }

  function keepScannerReady(input){
    if(!input)return()=>{};
    const focus=event=>{
      if(settings().barcodeScannerEnabled===false)return;
      const target=event?.target;
      if(target&&target!==document.body&&target!==input&&/INPUT|TEXTAREA|SELECT|BUTTON/.test(target.tagName))return;
      setTimeout(()=>input.focus({preventScroll:true}),0);
    };
    document.addEventListener("pointerdown",focus);window.addEventListener("focus",focus);focus();
    return()=>{document.removeEventListener("pointerdown",focus);window.removeEventListener("focus",focus)};
  }

  window.VarexHardware={settings,isNativePrinterReady,listPairedPrinters,printSale,testPrinter,makeReceiptCanvas,keepScannerReady};
})();
