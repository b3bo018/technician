const money=(value:number)=>new Intl.NumberFormat('en-AE',{minimumFractionDigits:3,maximumFractionDigits:3}).format(value||0);
const date=(value:any)=>{const raw=value?.toDate?.()||value;const parsed=raw?new Date(raw):new Date();return Number.isNaN(parsed.getTime())?String(value||''):new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(parsed)};

export function AgreementDocumentV2({agreement:a,company:c}:{agreement:any;company:any}){
 const rows=[
  [a.package_name||'SECURETRACK GPS TRACKING SERVICE',a.quantity,a.unit_price,a.quantity*a.unit_price,a.services],
  ...(a.renewal_enabled&&Number(a.renewal_price)>0?[[`RENEWAL ${a.package_name||'GPS TRACKING'}`,a.quantity,a.renewal_price,a.quantity*a.renewal_price,'Renewal service']]:[]),
  ['Device',1,a.device,a.device,''],['SIM Card',1,a.sim,a.sim,''],['Installation',1,a.installation,a.installation,''],
  ['Certificate',1,a.certificate,a.certificate,''],['Other charges',1,a.other,a.other,'']
 ].filter(row=>Number(row[3])>0);
 const calculatedSubtotal=(Number(a.quantity)||1)*(Number(a.unit_price)||0)+(Number(a.device)||0)+(Number(a.sim)||0)+(Number(a.installation)||0)+(Number(a.certificate)||0)+(Number(a.other)||0)-(Number(a.discount)||0);
 const subtotal=a.subtotal===undefined?calculatedSubtotal:Number(a.subtotal)||0,vatAmount=a.vat_amount===undefined?subtotal*(Number(a.vat)||0)/100:Number(a.vat_amount)||0,total=a.total===undefined?subtotal+vatAmount:Number(a.total)||0;
 const terms=String(a.terms||c.terms||'').split(/\r?\n/).map((line:string)=>line.trim()).filter(Boolean).map((line:string,index:number)=>{const cleaned=line.replace(/^\d+[.)]\s*/,'').replace(/^\.+\s*/,'').trim();return `${index+1}. ${cleaned}`});
 return <article id={a.reference} className="contract-sheet exact-agreement">
  <header className="exact-agreement-head"><img src="/securetrack-logo-document-hd.png" alt="SecureTrack X"/><div className="exact-document-titles"><strong>QUOTATION</strong><span>AGREEMENT</span></div></header>
  <div className="exact-contact-band"><span>☎ +971 45511700&nbsp;&nbsp;&nbsp; ● +971 521001690, +971 521001699</span><span>✉ {c.internal_email||'business@securetrackx.com'}</span></div>
  <section className="exact-recipient">
   <div><b>Recipient</b><strong>{a.client}</strong>{a.address&&String(a.address).split(/\r?\n/).map((line:string)=><span key={line}>{line}</span>)}<span><b>Phone:</b> {a.mobile||'—'}</span><span><b>Email:</b> {a.email||'—'}</span></div>
   <div><span><b>Agreement # {a.reference}</b></span><span><b>Date:</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {date(a.created_at)}</span></div>
  </section>
  <section className="exact-commercial"><table><thead><tr><th>S/L</th><th>Item</th><th>Qty</th><th>Price</th><th>Unit</th><th>Total</th></tr></thead><tbody>{rows.map((row,index)=><tr key={String(row[0])}><td>{index+1}</td><td><strong>{String(row[0]).toUpperCase()}</strong>{row[4]&&<small>{String(row[4])}</small>}</td><td>{row[1]}</td><td>{money(Number(row[2]))}</td><td>Unit</td><td>{money(Number(row[3]))}</td></tr>)}</tbody></table>
  </section>
  <section className="exact-totals"><span><span>Sub-Total</span><b>AED {money(subtotal)}</b></span><span><span>VAT ({Number(a.vat)||0}%)</span><b>AED {money(vatAmount)}</b></span><strong><span>Grand Total</span><b>AED {money(total)}</b></strong></section>
  <section className="exact-terms"><h2>T E R M S</h2><div>{terms.map((term:string,index:number)=><p key={index}>{term}</p>)}</div>{a.payment_terms&&<p className="exact-payment"><b>Payment terms:</b> {a.payment_terms}</p>}</section>
  <section className="exact-signatures">
   <div className="exact-company-sign"><b>Head of sales: {c.signatory||'Abdulla'}</b><span>Mob: +971 555846686</span><img src="/securetrack-authorized-signature.jpg" alt="Authorized signature"/><strong>For SECURETRACK</strong></div>
   <img className="exact-stamp" src="/securetrack-company-stamp.jpg" alt="SecureTrack company stamp"/>
   <div className="exact-client-sign"><b>Name : <span>{a.signer_name||''}</span></b><b>Designation: <span>{a.signer_designation||''}</span></b><b>Contact No: <span>{a.signer_mobile||''}</span></b><b>Signature :</b>{a.signature?<img src={a.signature} alt="Customer signature"/>:<i/>}</div>
  </section>
 </article>
}
