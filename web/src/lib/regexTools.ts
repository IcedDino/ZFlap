export interface RegexGenerationResult { values: string[]; error: string | null }
type Node =
  | { kind: 'literal'; value: string }
  | { kind: 'class'; values: string[] }
  | { kind: 'concat'; items: Node[] }
  | { kind: 'alt'; items: Node[] }
  | { kind: 'repeat'; node: Node; min: number; max: number }

const DEFAULT_ALPHABET = ['a', 'b', 'c', '0', '1']

class Parser {
  private i = 0
  constructor(private readonly source: string) {}
  parse(): Node { const node = this.parseAlternation(); if (this.i < this.source.length) throw new Error(`Unexpected token '${this.source[this.i]}' at ${this.i + 1}`); return node }
  private parseAlternation(): Node { const items=[this.parseConcat()]; while(this.peek()==='|'){this.i++;items.push(this.parseConcat())} return items.length===1?items[0]:{kind:'alt',items} }
  private parseConcat(): Node { const items:Node[]=[]; while(this.i<this.source.length&&!')|'.includes(this.peek()!)){const atom=this.parseAtom();items.push(this.parseQuantifier(atom))} return items.length===0?{kind:'literal',value:''}:items.length===1?items[0]:{kind:'concat',items} }
  private parseAtom(): Node {
    const ch=this.peek(); if(!ch) throw new Error('Expected an expression')
    if(ch==='('){this.i++;if(this.source.slice(this.i,this.i+2)==='?:')this.i+=2;const node=this.parseAlternation();if(this.peek()!==')')throw new Error('Missing closing parenthesis');this.i++;return node}
    if(ch==='[')return this.parseClass(); if(ch==='.') {this.i++;return{kind:'class',values:DEFAULT_ALPHABET}}
    if(ch==='^'||ch==='$'){this.i++;return{kind:'literal',value:''}}
    if(ch==='\\'){this.i++;const escaped=this.peek();if(!escaped)throw new Error('Trailing escape');this.i++;if(escaped==='d')return{kind:'class',values:[...'0123456789']};if(escaped==='w')return{kind:'class',values:[...'abcdefghijklmnopqrstuvwxyz0123456789_']};if(escaped==='s')return{kind:'class',values:[' ']};return{kind:'literal',value:escaped}}
    if('*+?}'.includes(ch))throw new Error(`Unexpected quantifier '${ch}'`);this.i++;return{kind:'literal',value:ch}
  }
  private parseClass(): Node { this.i++;let negated=false;if(this.peek()==='^'){negated=true;this.i++}const values:string[]=[];while(this.i<this.source.length&&this.peek()!==']'){const start=this.readClassChar();if(this.peek()==='-'&&this.source[this.i+1]!==']'){this.i++;const end=this.readClassChar();const a=start.charCodeAt(0),b=end.charCodeAt(0);if(a>b)throw new Error('Invalid character class range');for(let code=a;code<=b;code++)values.push(String.fromCharCode(code))}else values.push(start)}if(this.peek()!==']')throw new Error('Missing closing bracket');this.i++;const unique=[...new Set(values)];if(negated){const base=DEFAULT_ALPHABET.filter(ch=>!unique.includes(ch));return{kind:'class',values:base.length?base:DEFAULT_ALPHABET}}if(!unique.length)throw new Error('Empty character class');return{kind:'class',values:unique} }
  private readClassChar():string { if(this.peek()==='\\'){this.i++;const ch=this.peek();if(!ch)throw new Error('Trailing escape in character class');this.i++;return ch}const ch=this.peek();if(!ch)throw new Error('Unexpected end of character class');this.i++;return ch }
  private parseQuantifier(node:Node):Node { const ch=this.peek();if(!ch)return node;if(ch==='*'){this.i++;return{kind:'repeat',node,min:0,max:3}}if(ch==='+'){this.i++;return{kind:'repeat',node,min:1,max:3}}if(ch==='?'){this.i++;return{kind:'repeat',node,min:0,max:1}}if(ch!=='{')return node;const start=this.i++;const match=this.source.slice(start).match(/^\{(\d+)(,(\d*)?)?\}/);if(!match){this.i=start;return node}this.i=start+match[0].length;const min=Number(match[1]);const max=match[2]===undefined?min:match[3]===''?Math.min(min+3,6):Math.min(Number(match[3]),6);if(max<min)throw new Error('Invalid repetition range');return{kind:'repeat',node,min,max} }
  private peek():string|undefined{return this.source[this.i]}
}

function unique(values:string[],limit:number):string[]{return[...new Set(values)].slice(0,limit)}
function expand(node:Node,limit:number):string[]{
  if(node.kind==='literal')return[node.value]; if(node.kind==='class')return node.values.slice(0,limit)
  if(node.kind==='alt')return unique(node.items.flatMap(item=>expand(item,limit)).slice(0,limit),limit)
  if(node.kind==='concat'){let result=[''];for(const item of node.items){const next=expand(item,limit),combined:string[]=[];for(const a of result)for(const b of next){combined.push(a+b);if(combined.length>=limit)break}result=unique(combined,limit)}return result}
  const base=expand(node.node,limit),result:string[]=[];for(let count=node.min;count<=node.max;count++){let acc=[''];for(let i=0;i<count;i++){const next:string[]=[];for(const a of acc)for(const b of base){next.push(a+b);if(next.length>=limit)break}acc=unique(next,limit)}result.push(...acc);if(result.length>=limit)break}return unique(result,limit)
}

export function generateRegexStrings(source:string,count=12):RegexGenerationResult{const trimmed=source.trim();if(!trimmed)return{values:[],error:'Enter a regular expression first.'};try{return{values:expand(new Parser(trimmed).parse(),Math.max(4,count)),error:null}}catch(error){return{values:[],error:error instanceof Error?error.message:'Unable to generate strings for this expression.'}}}
