import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from 'docx';

const NAVY='09231F';
const GREEN='1D5A49';
const LIME='D9FF68';
const INK='18231F';
const MUTED='60716B';
const PALE='EEF4F1';
const WHITE='FFFFFF';
const CONTENT_WIDTH=9360;

const border=(color='D6E0DC',size=4)=>({style:BorderStyle.SINGLE,color,size});
const noBorder=()=>({style:BorderStyle.NONE,color:WHITE,size:0});
const noBorders={top:noBorder(),bottom:noBorder(),left:noBorder(),right:noBorder(),insideHorizontal:noBorder(),insideVertical:noBorder()};

function runsFromInline(text,{bold=false,italics=false,color=INK,size=22}={}){
  const parts=String(text||'').split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map(part=>{
    const marked=part.startsWith('**')&&part.endsWith('**');
    return new TextRun({text:marked?part.slice(2,-2):part,bold:bold||marked,italics,color,size,font:'Aptos'});
  });
}

function heading(text,level=HeadingLevel.HEADING_1){
  return new Paragraph({
    heading:level,
    keepNext:true,
    spacing:{before:level===HeadingLevel.HEADING_1?280:200,after:100},
    children:runsFromInline(text,{bold:true,color:NAVY,size:level===HeadingLevel.HEADING_1?29:25})
  });
}

function bodyParagraphs(content){
  const lines=String(content||'').replace(/\r\n?/g,'\n').split('\n');
  const children=[];
  for(const raw of lines){
    const line=raw.trim();
    if(!line){children.push(new Paragraph({spacing:{after:80}}));continue;}
    const markdownHeading=line.match(/^(#{1,3})\s+(.+)$/);
    if(markdownHeading){children.push(heading(markdownHeading[2],markdownHeading[1].length===1?HeadingLevel.HEADING_1:HeadingLevel.HEADING_2));continue;}
    const bullet=line.match(/^[-*•]\s+(.+)$/);
    if(bullet){children.push(new Paragraph({bullet:{level:0},spacing:{after:70,line:300},children:runsFromInline(bullet[1])}));continue;}
    const numbered=line.match(/^\d+[.)]\s+(.+)$/);
    if(numbered){children.push(new Paragraph({numbering:{reference:'ratio-numbering',level:0},spacing:{after:70,line:300},children:runsFromInline(numbered[1])}));continue;}
    const looksLikeHeading=line.length<=130&&/[A-ZÁÉÍÓÚÜÑ]/.test(line)&&line===line.toLocaleUpperCase('es-ES')&&!/[.!?]$/.test(line);
    if(looksLikeHeading){children.push(heading(line,HeadingLevel.HEADING_2));continue;}
    children.push(new Paragraph({alignment:AlignmentType.JUSTIFIED,spacing:{after:120,line:300},widowControl:true,children:runsFromInline(line)}));
  }
  return children;
}

function metadataTable(metadata){
  const rows=[
    ['EXPEDIENTE',metadata.reference||'Sin referencia','DOCUMENTO',metadata.documentType||'Documento de trabajo'],
    ['CLIENTE',metadata.clientName||'No indicado','VERSIÓN',String(metadata.versionNumber||1)],
    ['FECHA',metadata.dateLabel||'','ESTADO',metadata.statusLabel||'Borrador para revisión']
  ];
  return new Table({
    width:{size:CONTENT_WIDTH,type:WidthType.DXA},
    columnWidths:[1350,3330,1200,3480],
    borders:{top:border(),bottom:border(),left:border(),right:border(),insideHorizontal:border('E2E9E6',3),insideVertical:border('E2E9E6',3)},
    rows:rows.map(row=>new TableRow({children:row.map((value,index)=>new TableCell({
      width:{size:[1350,3330,1200,3480][index],type:WidthType.DXA},
      verticalAlign:VerticalAlign.CENTER,
      shading:index%2===0?{fill:PALE}:undefined,
      margins:{top:115,bottom:115,left:140,right:140},
      children:[new Paragraph({spacing:{after:0},children:[new TextRun({text:value,bold:index%2===0,color:index%2===0?GREEN:INK,size:index%2===0?17:20,font:'Aptos'})]})]
    }))}))
  });
}

function brandHeader(){
  return new Header({children:[
    new Paragraph({
      spacing:{after:80},
      border:{bottom:border(GREEN,12)},
      children:[
        new TextRun({text:'R',bold:true,color:NAVY,size:32,font:'Aptos Display'}),
        new TextRun({text:'/',bold:true,color:GREEN,size:32,font:'Aptos Display'}),
        new TextRun({text:'  RATIO ',bold:true,color:NAVY,size:22,font:'Aptos'}),
        new TextRun({text:'SOLUCIONES',bold:true,color:GREEN,size:22,font:'Aptos'}),
        new TextRun({text:'  ·  SOLUCIONES INTEGRALES',color:MUTED,size:16,font:'Aptos'})
      ]
    })
  ]});
}

function brandFooter(reference){
  return new Footer({children:[
    new Paragraph({
      border:{top:border('BFCBC6',4)},
      spacing:{before:80,after:0},
      children:[
        new TextRun({text:'www.ratiosoluciones.es  ·  clientes@ratiosoluciones.es',color:MUTED,size:16,font:'Aptos'}),
        new TextRun({text:`  ·  ${reference||'Expediente'}`,color:MUTED,size:16,font:'Aptos'}),
        new TextRun({text:'  ·  Página ',color:MUTED,size:16,font:'Aptos'}),
        new TextRun({children:[PageNumber.CURRENT],color:MUTED,size:16,font:'Aptos'}),
        new TextRun({text:' de ',color:MUTED,size:16,font:'Aptos'}),
        new TextRun({children:[PageNumber.TOTAL_PAGES],color:MUTED,size:16,font:'Aptos'})
      ]
    })
  ]});
}

export async function buildBrandedDocument(metadata,content){
  const title=String(metadata.title||'Documento de trabajo').trim();
  const doc=new Document({
    creator:'Ratio Soluciones',
    company:'Ratio Soluciones',
    title,
    description:'Documento de trabajo generado desde el CRM privado de Ratio Soluciones.',
    styles:{
      default:{document:{run:{font:'Aptos',size:22,color:INK},paragraph:{spacing:{after:120,line:300}}}},
      paragraphStyles:[
        {id:'Title',name:'Title',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:'Aptos Display',size:38,bold:true,color:NAVY},paragraph:{spacing:{before:180,after:100},keepNext:true}},
        {id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:'Aptos Display',size:29,bold:true,color:NAVY},paragraph:{spacing:{before:280,after:100},keepNext:true}},
        {id:'Heading2',name:'Heading 2',basedOn:'Normal',next:'Normal',quickFormat:true,run:{font:'Aptos',size:25,bold:true,color:GREEN},paragraph:{spacing:{before:200,after:80},keepNext:true}}
      ]
    },
    numbering:{config:[{reference:'ratio-numbering',levels:[{level:0,format:'decimal',text:'%1.',alignment:AlignmentType.LEFT,style:{paragraph:{indent:{left:720,hanging:360}}}}]}]},
    sections:[{
      properties:{page:{size:{width:12240,height:15840},margin:{top:1100,right:1440,bottom:1100,left:1440,header:500,footer:500}}},
      headers:{default:brandHeader()},
      footers:{default:brandFooter(metadata.reference)},
      children:[
        new Paragraph({style:'Title',children:[new TextRun({text:title,bold:true,color:NAVY,size:38,font:'Aptos Display'})]}),
        new Paragraph({spacing:{after:220},children:[new TextRun({text:'BORRADOR · PENDIENTE DE REVISIÓN PROFESIONAL',bold:true,color:GREEN,size:18,font:'Aptos'})]}),
        metadataTable(metadata),
        new Paragraph({spacing:{after:160}}),
        ...bodyParagraphs(content)
      ]
    }]
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

export function safeDocumentFileName(title,reference,versionNumber){
  const base=`${reference||'expediente'}-${title||'documento'}-v${versionNumber||1}`
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,150);
  return `${base||'documento-ratio'}.docx`;
}
