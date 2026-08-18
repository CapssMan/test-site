#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");const crypto=require("node:crypto");const fs=require("node:fs");const path=require("node:path");
const root=path.resolve(__dirname,"..");
const publicBank=JSON.parse(fs.readFileSync(path.join(root,"data","sales-junior.json"),"utf8"));
const privatePath=process.argv[2]||path.resolve(root,"..","skillcheck-private-sales-r1","sales-junior.json");
const privateBank=JSON.parse(fs.readFileSync(privatePath,"utf8"));
const sha256=value=>crypto.createHash("sha256").update(String(value),"utf8").digest("hex");
const{publicDigest,...publicCore}=publicBank;
assert.equal(publicBank.testId,"sales-junior");assert.equal(publicBank.bankVersion,"Sales / Business Development Junior v1.0");assert.equal(publicBank.questions.length,40);assert.equal(publicBank.questionsPerAttempt,40);assert.equal(Object.keys(publicBank.blocks).length,8);assert.equal(publicDigest,sha256(JSON.stringify(publicCore)));assert.equal(privateBank.publicDigest,publicDigest);
const expected={easy:8,medium:18,case:9,calc:4,hard:1},distribution={},blocks={},positions=[0,0,0,0];let points=0,seconds=0;const forbidden=/correct|answer|comment|explanation|solution|rationale/i;
function noPrivate(value,location){if(Array.isArray(value))return value.forEach((item,index)=>noPrivate(item,`${location}[${index}]`));if(!value||typeof value!=="object")return;for(const[key,child]of Object.entries(value)){assert(!forbidden.test(key),`${location}.${key} leaks private data`);noPrivate(child,`${location}.${key}`);}}
noPrivate(publicBank,"publicBank");
publicBank.questions.forEach((question,index)=>{const privateQuestion=privateBank.questions[index];assert.equal(privateQuestion.id,question.id);assert.equal(privateQuestion.options.length,4);assert(privateQuestion.options.some(option=>option.id===privateQuestion.correctOptionId));assert(privateQuestion.comment.length>=40);distribution[question.difficulty]=(distribution[question.difficulty]||0)+1;blocks[question.block]=(blocks[question.block]||0)+1;positions[question.options.findIndex(option=>option.id===privateQuestion.correctOptionId)]++;points+=question.points;seconds+=question.timeLimit;});
assert.deepEqual(distribution,expected);Object.values(blocks).forEach(count=>assert.equal(count,5));assert.deepEqual(positions,[10,10,10,10]);assert(seconds>=2600&&seconds<=3000);
console.log(JSON.stringify({questions:40,blocks,distribution,correctPositions:positions,totalPoints:points,estimatedMinutes:Math.round(seconds/60),publicDigest},null,2));
