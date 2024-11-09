var u=(r,n)=>{let e=r.filter(t=>t.type==="NUMBER").map(t=>t.value);if(e.length===1){if(!n)return null;let t=e[0];return t.is_percent=!0,{type:"NUMBER",value:t}}if(e.length===2){let t=e[0],l=e[1];return{type:"NUMBER",value:{value:t.value/l.value,is_percent:n,merged_minus:!1}}}return null},_={rules:[`
      NUMBER IDENT* K_AS I_% K_OF NUMBER -> percent_to
      NUMBER IDENT* (K_TO | K_AS | K_IN) I_% -> percent_to
      NUMBER IDENT* K_IS NUMBER K_OF K_WHAT -> percent_of
    `],action:(r,n)=>{let e;return r==="percent_to"&&(e=u(n,!0)),r==="percent_of"&&(e=u(n,!1)),e?[e]:null}};export{_ as default};
