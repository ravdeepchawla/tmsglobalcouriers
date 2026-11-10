function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
const API={base:"https://admin.hpllogistics.co/api/tracking_api/get_tracking_data",companyId:"33",customerCode:"H1291"};
const WHATSAPP="919501001114";
const RATES=[
 {carrier:"DHL",service:"International Express",destination:"Canada",min:0,max:2,base:1800,perKg:0},
 {carrier:"DHL",service:"International Express",destination:"Canada",min:2.01,max:5,base:1800,perKg:550},
 {carrier:"FedEx",service:"International Express",destination:"USA",min:0,max:2,base:1650,perKg:0},
 {carrier:"FedEx",service:"International Express",destination:"USA",min:2.01,max:5,base:1650,perKg:500},
 {carrier:"UPS",service:"International Express",destination:"United Kingdom",min:0,max:2,base:1750,perKg:0},
 {carrier:"UPS",service:"International Express",destination:"United Kingdom",min:2.01,max:5,base:1750,perKg:525}
];
const SEND_RULES = [
 {keywords:["ghee","oil","liquid","perfume","petrol","fuel"], level:"review", title:"Liquids / oils", message:"May be restricted by carrier or destination. Ask TMS Global before booking."},
 {keywords:["medicine","medicines","tablet","capsule","syrup","prescription"], level:"review", title:"Medicines", message:"Destination-country and carrier rules may apply. Prescription/supporting documents may be required."},
 {keywords:["battery","power bank","lithium","powerbank"], level:"review", title:"Batteries / power banks", message:"Transport restrictions may apply, especially for lithium batteries."},
 {keywords:["food","eatable","eatables","pickle","papad","sweets","snacks","spices","masala","dry fruits","biscuits","chocolate"], level:"review", title:"Food / eatables", message:"Food import rules vary by destination. Packaging, ingredients and quantity can matter."},
 {keywords:["cosmetic","cosmetics","cream","lotion","shampoo"], level:"review", title:"Cosmetics / toiletries", message:"Liquid, aerosol and destination restrictions may apply."},
 {keywords:["seed","seeds","plant","plants","soil"], level:"restricted", title:"Plants / seeds / soil", message:"Often subject to strict biosecurity and import controls. Confirm before sending."},
 {keywords:["weapon","gun","firearm","ammunition","explosive","fireworks"], level:"restricted", title:"Prohibited / dangerous goods", message:"Do not book until TMS Global confirms that the item is legally and safely transportable."}
];

function calcWeight(b){const pieces=Math.max(1,Number(b.pieces)||1),actual=Math.max(0,Number(b.actual)||0),l=Math.max(0,Number(b.length)||0),w=Math.max(0,Number(b.width)||0),h=Math.max(0,Number(b.height)||0),divisor=Math.max(1,Number(b.divisor)||5000);const actualTotal=actual*pieces,volumetricTotal=(l*w*h/divisor)*pieces;return{pieces,actualTotal,volumetricTotal,chargeableWeight:Math.max(actualTotal,volumetricTotal),divisor}}
function localQuote(b){const c=calcWeight(b),service=b.service||"International Express";const r=RATES.find(r=>r.destination===b.destination&&r.carrier===b.carrier&&r.service===service&&r.min<=c.chargeableWeight&&r.max>=c.chargeableWeight);if(!r)return{found:false,...c,message:"No configured tariff for this combination yet."};return{found:true,...c,carrier:b.carrier,service,destination:b.destination,currency:"INR",estimatedFreight:Math.round(r.base+Math.max(0,c.chargeableWeight-r.min)*r.perKg)}}
async function liveTrack(awb){
  if(!awb)return{error:"Tracking number required."};
  try{
    const u=new URL(API.base);u.searchParams.set("api_company_id",API.companyId);u.searchParams.set("customer_code",API.customerCode);u.searchParams.set("tracking_no",awb);
    const r=await fetch(u);if(!r.ok)throw new Error("HTTP "+r.status);
    const data=await r.json(),t=Array.isArray(data)?data[0]:data;
    if(!t||t.errors||!t.docket_info)return{error:"No shipment found for that tracking number."};
    const info=Object.fromEntries(t.docket_info);
    const events=(t.docket_events||[]).map(e=>({title:e.event_description,location:e.event_location||"",at:e.event_at||"",state:e.event_state||""}));
    return{live:true,awb:t.tracking_no||awb,carrier:info["Service Name"]||"TMS Global",status:info["Status"]||"In Transit",origin:info["Origin"]||"",destination:info["Destination"]||"",expected_delivery:t.expected_datetime||null,forwarding_no:t.forwarding_no||null,booked:info["Booking Date"]||null,delivered_at:info["Delivery Date and Time"]||null,origin_city:info["Shipper City"]||"",destination_city:info["Consignee City"]||"",pieces:t.pcs||null,weight:t.chargeable_weight||null,events}
  }catch(err){console.error("Tracking lookup failed:",err);return{error:"Tracking service is unavailable right now. Please try again shortly."}}
}
function sendCheck(q){q=String(q||"").trim().toLowerCase();if(!q)return{level:"unknown",title:"Tell us what you want to send",message:"Enter an item name and we\u2019ll show the type of review it may need."};const hit=SEND_RULES.find(r=>r.keywords.some(k=>q.includes(k)));return hit||{level:"general",title:"Item may be accepted",message:"This is only a preliminary check. Carrier, customs and destination rules still apply."}}
function openWhatsApp(lines){window.open("https://wa.me/"+WHATSAPP+"?text="+encodeURIComponent(lines.join("\n")),"_blank","noopener")}
/* No backend: same call signatures as the Node version, handled in the browser. */
async function post(url,d){
  switch(url){
    case"/api/calculate-weight":return calcWeight(d);
    case"/api/quote":return localQuote(d);
    case"/api/track":return liveTrack(d.awb);
    case"/api/enquiries":
      if(!d.name||!d.phone||!d.email||!d.message)return{error:"Name, phone, email and message are required."};
      openWhatsApp(["New enquiry from the website","Name: "+d.name,"Phone: "+d.phone,"Email: "+d.email,d.awb?"AWB: "+d.awb:null,(d.origin||d.destination)?"Route: "+(d.origin||"?")+" → "+(d.destination||"?"):null,"",d.message].filter(x=>x!==undefined&&x!==false&&x!==null));
      return{ok:true};
    case"/api/item-requests":{
      if(!d.name||!d.phone||!d.destination)return{error:"Name, phone number and destination are required."};
      const ref="TMS-"+Date.now().toString().slice(-8);
      const lines=["Item request "+ref,"Name: "+d.name,"Phone: "+d.phone,"Destination: "+d.destination];
      if(d.submissionType==="list")lines.push("Items:",...d.items.map(i=>"- "+i.name+" x"+i.quantity+(i.approximateKg?" (~"+i.approximateKg+" kg)":"")));
      else lines.push(d.photos.length+" photo(s) - I will attach them in this chat.");
      if(d.message)lines.push("","Note: "+d.message);
      openWhatsApp(lines);return{ok:true,referenceNo:ref}}
  }
  return{error:"Unknown endpoint"}
}
function getWeightData(){return{pieces:+pieces.value,actual:+actual.value,length:+length.value,width:+width.value,height:+height.value,divisor:5000}}
async function calculate(){const d=await post("/api/calculate-weight",getWeightData());ao.textContent=d.actualTotal.toFixed(2)+" kg";vo.textContent=d.volumetricTotal.toFixed(2)+" kg";co.textContent=d.chargeableWeight.toFixed(2)+" kg";return d}
async function getQuote(){const d=await post("/api/quote",{...getWeightData(),destination:destination.value,carrier:qcarrier.value,service:"International Express"});quoteResult.innerHTML=d.found?`<div class="result"><b>Estimated freight: ₹${d.estimatedFreight.toLocaleString("en-IN")}</b><br><small>${d.chargeableWeight.toFixed(2)} kg chargeable · ${d.carrier} · ${d.destination}</small></div>`:`<div class="result">${d.message}</div>`}
function fmtDate(s){const d=new Date(String(s).replace(" ","T"));return isNaN(d)?s:d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}
function fmtTime(s){const d=new Date(String(s).replace(" ","T"));return isNaN(d)?"":d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
function trackStage(d){const st=String(d.status).toLowerCase();if(/deliver/.test(st)&&!/undeliver|out for|not deliver/.test(st))return 3;if(/\b(on hold|hold|held|exception|shipment delayed|clearance delay)\b/.test(st))return 4;return d.events.length?2:1}
function toggleHistory(b){const box=b.previousElementSibling;box.classList.toggle("open");b.textContent=box.classList.contains("open")?"Show less":"Show full history"}
async function track(awbOverride){
  const awb={value:(awbOverride||document.getElementById("hAwb")?.value||"").trim()};
  const trackResult=document.getElementById("trackResult");
  trackResult.closest(".visual")?.classList.add("has-tracking-result");
  trackResult.innerHTML='<div class="result">Looking up shipment…</div>';
  const d=await post("/api/track",{awb:awb.value.trim()});
  if(d.error){trackResult.innerHTML=`<div class="result trk-err">${esc(d.error)}</div>`;return}
  const stage=trackStage(d),done=stage===3,held=stage===4,statusTone=done?"delivered":held?"hold":stage===2?"transit":"booked";
  const steps=["Booked","In transit","Delivered"].map((n,i)=>{const cls=held?(i===0?"done":i===1?"now hold":""):i+1<stage||done?"done":i+1===stage?"now":"";return `<li class="${cls}"><span></span>${n}</li>`}).join("");
  const facts=[["From",[d.origin_city,d.origin].filter(Boolean).join(", ")],["To",[d.destination_city,d.destination].filter(Boolean).join(", ")],["Booked",d.booked&&fmtDate(d.booked)],[done?"Delivered":"Expected",done?d.delivered_at&&fmtDate(d.delivered_at):d.expected_delivery&&fmtDate(d.expected_delivery)],["Service",d.carrier],["Pieces",d.pieces]].filter(x=>String(x[0]).toLowerCase()!=="weight"&&x[1]).map(x=>`<div><small>${x[0]}</small><b>${esc(x[1])}</b></div>`).join("");
  let last="";const rows=d.events.map((e,i)=>{const day=e.at?fmtDate(e.at):"";const x=i>=5?" x":"";const head=day&&day!==last?`<h4 class="${x.trim()}">${esc(day)}</h4>`:"";last=day||last;return`${head}<div class="trk-ev${i===0?" first":""}${x}"><i></i><div><b>${esc(e.title)}</b><span>${esc([e.location,fmtTime(e.at)].filter(Boolean).join(" · "))}</span></div></div>`}).join("");
  trackResult.innerHTML=`<div class="result trk"><div class="trk-head"><div><small>AWB ${esc(d.awb)}</small><h3>${esc(d.status)}</h3></div><span class="trk-badge ${statusTone}">${esc(d.carrier)}</span></div><ol class="trk-steps">${steps}</ol><div class="trk-facts">${facts}</div><div class="trk-tl ${statusTone}${d.events.length<=5?" open":""}">${rows}</div>${d.events.length>5?'<button type="button" class="trk-more" onclick="toggleHistory(this)">Show full history</button>':""}</div>`}
function heroTrack(){const input=document.getElementById("hAwb");if(!input.value.trim()){input.focus();return}track(input.value.trim())}
async function sendEnquiry(e){e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const r=await post("/api/enquiries",d);formMsg.textContent=r.ok?"Opening WhatsApp so you can send your enquiry to TMS Global.":r.error}

function addItemRow(){
 const c=document.getElementById('customRows'); const d=document.createElement('div'); d.className='custom-row';
 d.innerHTML='<input class="req-item" placeholder="Item name *" required><input class="req-qty" type="number" min="1" value="1" placeholder="Qty"><input class="req-kg" type="number" min="0" step="0.01" placeholder="Approx. kg"><button type="button" onclick="this.parentElement.remove()">✕</button>'; c.appendChild(d);
}
function setRequestType(type,btn){document.getElementById('requestType').value=type;document.querySelectorAll('.request-tab').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.getElementById('listPanel').style.display=type==='list'?'block':'none';document.getElementById('photoPanel').style.display=type==='photos'?'block':'none';document.querySelectorAll('.req-item').forEach(x=>x.required=type==='list')}
async function submitItemRequest(e){e.preventDefault();const type=document.getElementById('requestType').value, result=document.getElementById('itemRequestResult');const phone=document.getElementById('reqPhone').value.trim();if(!phone){result.textContent='Phone number is required.';return}let items=[];if(type==='list'){items=[...document.querySelectorAll('.custom-row')].map(r=>({name:r.querySelector('.req-item').value.trim(),quantity:+r.querySelector('.req-qty').value||1,approximateKg:+r.querySelector('.req-kg').value||0})).filter(x=>x.name);if(!items.length){result.textContent='Please add at least one item.';return}}let photos=[];if(type==='photos'){const files=[...document.getElementById('articlePhotos').files];if(!files.length){result.textContent='Please upload at least one photo.';return}for(const f of files){if(f.size>5*1024*1024){result.textContent=f.name+' is larger than 5 MB.';return}photos.push({name:f.name,type:f.type,data:await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f)})})}}const d=await post('/api/item-requests',{name:document.getElementById('reqName').value.trim(),phone,destination:document.getElementById('reqDestination').value.trim(),submissionType:type,items,photos,message:document.getElementById('reqMessage').value.trim()});if(d.ok){result.innerHTML='✅ Request submitted successfully.<br>Reference No.: <b>'+d.referenceNo+'</b><br>Our team will contact you on <b>'+phone+'</b>.';document.getElementById('itemRequestForm').reset();document.getElementById('customRows').innerHTML='';addItemRow();document.getElementById('photoPreview').innerHTML=''}else result.textContent=d.error||'Unable to submit request.'}
addItemRow();
const ap=document.getElementById('articlePhotos'); if(ap) ap.addEventListener('change',()=>{const p=document.getElementById('photoPreview');p.innerHTML='';[...ap.files].forEach(f=>{const i=document.createElement('img');i.src=URL.createObjectURL(f);p.appendChild(i)})});

function toggleMenu(){document.getElementById('mainNav')?.classList.toggle('open')}
async function checkSendItem(){const q=document.getElementById('sendItemInput').value.trim();const box=document.getElementById('sendCheckResult');if(!q){box.innerHTML='<b>Quick check</b><span>Enter an item first.</span>';return}box.innerHTML='<b>Checking…</b><span>Please wait.</span>';try{const d=sendCheck(q);const cls=d.level==='restricted'?'restricted':d.level==='review'?'review':'general';box.className='send-result '+cls;box.innerHTML='<b>'+esc(d.title)+'</b><span>'+esc(d.message)+'</span><a href="#item-request">Send details to TMS Global →</a>'}catch(e){box.innerHTML='<b>Unable to check</b><span>Please contact TMS Global directly.</span>'}}
function checkItemExample(x){document.getElementById('sendItemInput').value=x;checkSendItem()}
document.addEventListener('click',e=>{if(e.target.matches('#mainNav a'))document.getElementById('mainNav')?.classList.remove('open')});
