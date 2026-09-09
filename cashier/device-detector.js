(function(root){
  "use strict";

  const brandRules=[
    {name:"HONOR",pattern:/\b(?:HONOR|Hihonor|MagicPad)\b|\b(?:AGM3|BRT|ELN|HEM|HEY2?|ROD2?|ROL|ROH)-[A-Z0-9]+\b/i},
    {name:"OnePlus",pattern:/\bOnePlus\b|\bONEPLUS\b/i},
    {name:"Samsung",pattern:/SamsungBrowser|\bSAMSUNG\b|\b(?:SM|GT|SCH|SGH)-[A-Z0-9-]+\b/i},
    {name:"Google",pattern:/\bPixel(?:\s|$)/i},
    {name:"OPPO",pattern:/\bOPPO\b|\bCPH\d{4}\b/i},
    {name:"Xiaomi",pattern:/\bXiaomi\b|\bRedmi\b|\bPOCO\b|\bMi (?:Pad|Note|\d)/i},
    {name:"vivo",pattern:/\bvivo\b/i},
    {name:"realme",pattern:/\brealme\b|\bRMX\d+\b/i},
    {name:"HUAWEI",pattern:/\bHUAWEI\b|\b(?:AGS|BAH|DBY|MRX|WGR|BZI)-[A-Z0-9]+\b/i},
    {name:"Lenovo",pattern:/\bLenovo\b|\bTB-[A-Z0-9-]+\b/i},
    {name:"Motorola",pattern:/\bMotorola\b|\bmoto\s+[a-z0-9]+|\bXT\d{4,}\b/i},
    {name:"Sony",pattern:/\bSony\b|\bXQ-[A-Z0-9-]+\b/i},
    {name:"Nokia",pattern:/\bNokia\b/i},
    {name:"ASUS",pattern:/\bASUS\b|ROG Phone|ASUS_I/i},
    {name:"ZTE",pattern:/\bZTE\b|\bNX\d{3,}\b/i},
    {name:"TECNO",pattern:/\bTECNO\b/i},
    {name:"Infinix",pattern:/\bInfinix\b/i},
    {name:"itel",pattern:/\bitel\b/i}
  ];

  const knownProducts=new Map([
    ["AGM3-W09HN","HONOR Pad X8"],
    ["ELN-L09","HONOR Pad X9"],
    ["HEY-W09","HONOR Pad 8"],
    ["HEY2-W09","HONOR Pad 9"],
    ["ROD2-W09","HONOR MagicPad 2"]
  ]);

  function text(value){return String(value||"").trim()}
  function cleanModel(value){
    const model=text(value)
      .replace(/^(?:HONOR|HUAWEI|SAMSUNG|OPPO|Xiaomi|Redmi|POCO|vivo|realme|Lenovo|Motorola|Sony|Nokia|ASUS|ZTE|TECNO|Infinix|itel)\s+/i,"")
      .replace(/\s+/g," ")
      .trim();
    if(!model||model.length>52||/^(?:K|Android|Linux|Build|wv)$/i.test(model))return "";
    return model;
  }

  function extractModel(userAgent,hintedModel){
    const hint=cleanModel(hintedModel);
    if(hint)return hint;
    const ua=text(userAgent);
    const buildMatch=ua.match(/;\s*([^;()]+?)\s+Build\/[^;)]*/i);
    if(buildMatch){
      const buildModel=cleanModel(buildMatch[1]);
      if(buildModel&&!/^(?:[a-z]{2}(?:-[a-z]{2})?|U)$/i.test(buildModel))return buildModel;
    }
    const directMatch=ua.match(/\b((?:SM|GT|SCH|SGH|CPH|RMX|TB|XQ|XT|AGM3|BRT|ELN|HEM|HEY2?|ROD2?|ROL|ROH)-?[A-Z0-9-]{3,}|Pixel\s+[A-Za-z0-9 ]{1,24})\b/i);
    return cleanModel(directMatch?.[1]||"");
  }

  function detectBrand(source){
    const match=brandRules.find(rule=>rule.pattern.test(source));
    return match?.name||"";
  }

  function detect(options={}){
    const userAgent=text(options.userAgent);
    const platform=text(options.platform).toLowerCase();
    const touchPoints=Number(options.touchPoints||0);
    const coarsePointer=Boolean(options.coarsePointer);
    const mobile=typeof options.mobile==="boolean"?options.mobile:null;
    const screenWidth=Number(options.screenWidth||options.innerWidth||0);
    const screenHeight=Number(options.screenHeight||options.innerHeight||0);
    const shortSide=Math.min(screenWidth||Infinity,screenHeight||Infinity);
    const longestSide=Math.max(screenWidth,screenHeight);
    const architecture=text(options.architecture).toLowerCase();
    const model=extractModel(userAgent,options.model);
    const source=`${userAgent} ${options.model||""} ${model}`;

    const isIPad=/iPad/i.test(userAgent)||(/Macintosh/i.test(userAgent)&&touchPoints>1);
    const isIPhone=/iPhone|iPod/i.test(userAgent);
    const isChromeOS=/CrOS/i.test(userAgent)||platform.includes("chrome os");
    // Android tablets can deliberately send a desktop Linux user agent when
    // Chrome's "Desktop site" mode is enabled. Touch, tablet dimensions and a
    // non-mobile client hint are more reliable than the missing "Android" word.
    const desktopModeAndroidTablet=(/Linux/i.test(userAgent)||platform.includes("linux"))&&
      !isChromeOS&&touchPoints>=2&&shortSide>=600&&longestSide<=2600&&
      (mobile===false||coarsePointer||/arm|aarch/i.test(architecture));
    const touchLinux=(/Linux/i.test(userAgent)||platform.includes("linux"))&&touchPoints>0&&coarsePointer&&!isChromeOS;
    const isAndroid=/Android/i.test(userAgent)||platform.includes("android")||brandRules.some(rule=>rule.pattern.test(source))||desktopModeAndroidTablet||touchLinux;

    if(isIPad)return {kind:"ipad",formFactor:"tablet",operatingSystem:"iOS",brand:"Apple",model:"",productName:"iPad"};
    if(isIPhone)return {kind:"iphone",formFactor:"phone",operatingSystem:"iOS",brand:"Apple",model:"",productName:"iPhone"};
    if(isAndroid){
      const tablet=desktopModeAndroidTablet||mobile===false||(!/Mobile/i.test(userAgent)&&(mobile!==true))||(Number.isFinite(shortSide)&&shortSide>=600);
      const brand=detectBrand(source);
      return {
        kind:tablet?"android-tablet":"android-phone",
        formFactor:tablet?"tablet":"phone",
        operatingSystem:"Android",
        brand,
        model,
        productName:knownProducts.get(model.toUpperCase())||""
      };
    }

    const laptop=longestSide>0&&longestSide<=1600;
    const operatingSystem=/Windows/i.test(userAgent)||platform.includes("win")?"Windows":/Macintosh|Mac OS/i.test(userAgent)||platform.includes("mac")?"macOS":isChromeOS?"ChromeOS":/Linux/i.test(userAgent)||platform.includes("linux")?"Linux":"";
    return {kind:laptop?"laptop":"computer",formFactor:laptop?"laptop":"computer",operatingSystem,brand:"",model:"",productName:""};
  }

  root.VAREXDeviceDetector=Object.freeze({detect});
})(typeof globalThis!=="undefined"?globalThis:window);
