/* SPDX-License-Identifier: MIT
 * Copyright (c) 2026 KanjiBunkai contributors
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to
 * do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
/* Shared, bounded answer-intent parser. No game data, network or learning work. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.KB29LiveAnswers=api})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 'use strict';
 const segmenter=typeof Intl?.Segmenter==='function'?new Intl.Segmenter('ja',{granularity:'grapheme'}):null;
 function oneCharacter(text){if(!segmenter)return Array.from(text).length===1;let count=0;for(const _ of segmenter.segment(text))if(++count>1)return false;return count===1}
 function parse(value){
  const original=String(value??'').trim(),single=oneCharacter(original);
  let text=original.normalize('NFKC');if(!text||Array.from(text).length>80)return null;
  text=text.replace(/^(?:答え|こたえ|正解)\s*(?:は|[:=])?\s*/u,'').replace(/(?:だと思います|と思います|だと思う|と思う|です|かな|かも)?[!?。]*$/u,'').trim();
  text=text.replace(/^[「『(]\s*/u,'').replace(/\s*[」』)]$/u,'');
  if(/^\p{Script=Han}$/u.test(text))return{kind:'character',character:text,label:text};
  const explicit=text.match(/^(.*?)(?:で|=|→)\s*(\p{Script=Han})$/u);const character=explicit?.[2]||null;
  let body=(explicit?explicit[1]:text).replace(/^(?:筆画番号|筆画|画番号)\s*[:=]?\s*/u,'').replace(/(?:画目|画|番目|番)/gu,' ').trim();
  body=body.replace(/(\d)\s*[-~〜]\s*(?=\d)/gu,'$1-');
  if(!/^\d{1,3}(?:-\d{1,3})?(?:[\s,、・/+&と]+\d{1,3}(?:-\d{1,3})?)*$/u.test(body))return single?{kind:'character',character:text,label:original}:null;
  const strokes=[];let invalid=false;
  for(const part of body.split(/[\s,、・/+&と]+/u)){
   const range=part.split('-').map(Number),from=range[0],to=range[1]??from;
   if(from<1||to<from||to>99||to-from+1>32){invalid=true;continue}
   for(let n=from;n<=to;n++){if(!strokes.includes(n))strokes.push(n);if(strokes.length>32){invalid=true;break}}
  }
  strokes.sort((a,b)=>a-b);return{kind:'strokes',strokes,character,invalid,label:character||`${invalid?body:strokes.join('・')}画`};
 }
 return Object.freeze({parse});
});
