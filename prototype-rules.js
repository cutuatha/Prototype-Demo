/* Prototype Core Rules Registry — canonical design record.
   Approved design rules are not automatically proof of feature implementation.
   Local decision events are stored in this browser; the registry is versioned in this file. */
(function(global){
"use strict";
const REGISTRY = {
  id:"prototype-core-rules",
  version:"0.1.0",
  updated:"2026-10-21",
  description:"Canonical record of approved Prototype design requirements and implementation status.",
  rules:[
    {id:"EQ-001",area:"Equipment search",title:"Price-first truck search",status:"approved_design",implementation:"not_yet_enforced",rule:"Truck asking-price range is the primary search criterion. Minimum price is optional; maximum price is required. Values must be nonnegative, and minimum cannot exceed maximum."},
    {id:"EQ-002",area:"Equipment search",title:"Manufacturer multi-select",status:"approved_design",implementation:"not_yet_enforced",rule:"Allow multiple manufacturers. Default is all manufacturers; no model is required. Model is an optional filter."},
    {id:"EQ-003",area:"Equipment search",title:"Exclude unpriced and auction listings",status:"approved_design",implementation:"not_yet_enforced",rule:"Exclude listings without a published asking price and exclude auction listings from truck-search results."},
    {id:"EQ-004",area:"Equipment search",title:"Real listing transparency",status:"approved_design",implementation:"partial",rule:"Use actual accessible listings when possible, identify their source, and never present simulated listings as real seller advertisements. Static pages may need an external search service to import listings."},
    {id:"EQ-005",area:"Equipment selection",title:"Compare and select controls",status:"approved_design",implementation:"partial",rule:"Each equipment listing has an identifying ID, a persistent Compare to Others control, and Select Now. Select Now requires explicit confirmation and does not authorize purchase, financing, funds commitment, or acquisition."},
    {id:"EQ-006",area:"Equipment selection",title:"Truck before trailer",status:"approved_design",implementation:"partial",rule:"Do not proceed to trailer selection until the owner explicitly confirms a truck. Never infer confirmation."},
    {id:"EQ-007",area:"Title due diligence",title:"Unknown title status",status:"approved_design",implementation:"not_yet_enforced",rule:"If a listing does not mention title status, assume clean for initial screening but label it unverified. Do not apply an automatic salvage-related insurance penalty solely because status is unstated."},
    {id:"EQ-008",area:"Title due diligence",title:"Salvage and rebuilt titles",status:"approved_design",implementation:"not_yet_enforced",rule:"Clearly flag stated salvage or rebuilt titles. Model possible insurance restrictions, higher costs, or unavailability without assuming every insurer responds identically."},
    {id:"EQ-009",area:"Due diligence",title:"Reuse existing simulated checks",status:"approved_design",implementation:"not_yet_enforced",rule:"Use the existing simulated due-diligence workflow for title/VIN, maintenance history, inspection, financing, and insurance questions. Do not create a duplicate standalone title workflow. Simulated checks are not real-world verification."},
    {id:"EQ-010",area:"Inspection",title:"Seller type affects pass probability",status:"approved_design",implementation:"not_yet_enforced",rule:"Dealer-sold equipment has a higher provisional chance of passing initial inspection than comparable private-sale equipment, but no guarantee. Documented inspections and maintenance can improve the modeled outcome; known defects and title issues remain relevant. Do not invent a precise empirical pass rate without evidence."},
    {id:"EQ-011",area:"Inspection",title:"Inspection failures",status:"approved_design",implementation:"not_yet_enforced",rule:"A failed safety/mechanical inspection may block dispatch until required repairs and a successful retest. Mechanical inspection, title status, and insurance eligibility are distinct checks."},
    {id:"FIN-001",area:"Financial setup",title:"Startup funds before equipment",status:"approved_design",implementation:"partial",rule:"Establish startup funds, startup costs, operating expenses, and a reserve based on 30, 45, or 60 days of projected operating costs before equipment selection."},
    {id:"EQ-012",area:"Equipment finance",title:"Down payment presentation",status:"approved_design",implementation:"not_yet_enforced",rule:"Whenever a down payment is presented, show both the dollar amount and percentage of purchase price."},
    {id:"SYS-001",area:"Decision management",title:"Decision status and change control",status:"approved_design",implementation:"partial",rule:"Distinguish proposed, approved design, implemented, and tested. An approval is not proof of implementation. Do not reopen a final decision unless the owner asks or a genuine conflict/new evidence requires attention."},
    {id:"SYS-002",area:"Decision management",title:"Preserve owner authority",status:"approved_design",implementation:"partial",rule:"Keep an authoritative sequential state and decision ledger. Preserve confirmed decisions and their status; do not silently change them or ask the owner to repeat them."}
  ]
};
const KEY="prototypeDecisionLedger";
function readEvents(){try{return JSON.parse(localStorage.getItem(KEY)||"[]");}catch(e){return[];}}
function record(event){try{const events=readEvents();events.push(Object.assign({at:new Date().toISOString()},event||{}));localStorage.setItem(KEY,JSON.stringify(events));return true;}catch(e){return false;}}
function statusLabel(s){return ({proposed:"Proposed",approved_design:"Approved design",implemented:"Implemented",tested:"Tested"}[s]||s);}
global.PrototypeCore={registry:REGISTRY,readEvents,record,statusLabel};
})(window);