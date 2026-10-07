import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const request={id:'request',raw_text:'Headphones under $100',status:'completed',constraints:{max_total_minor:10000,latest_arrival:'2026-10-14',required_features:[],device:null,flexibility:[]},error:null};
const group={id:'group',run_id:'run',profile:'small',status:'DRAFT'};
async function mock(page:any,journey:any){await page.route('**/api/**',(route:any)=>{const path=new URL(route.request().url()).pathname;return route.fulfill({json:path==='/api/config'?{mode:'fixture'}:path==='/api/session'?{run_id:'run'}:path==='/api/purchases'?[]:journey});});}
test('storefront browses before search and keeps failed searches separate from legacy quotes',async({page},info)=>{
  const journey:any={request:null,group,products:[],assessments:[],rounds:[],negotiation:null,status:null,eligible:false,compatible_count:0};await mock(page,journey);await page.goto('/');
  await expect(page.getByRole('heading',{name:'Shop together. Pay less.'})).toBeVisible();await expect(page.getByRole('button',{name:/Explore /})).toHaveCount(6);
  await expect(page.getByRole('img',{name:'Illustrative photograph of Cabin One'})).toBeVisible();
  mkdirSync('../.impeccable/review',{recursive:true});
  await page.screenshot({path:`../.impeccable/review/storefront-${info.project.name}.png`,fullPage:true});
  journey.request={...request,status:'failed',error:'Private model diagnostics'};journey.status={group:{status:'OPEN'},offer:{product_id:'arc-991',title:'Arc 991 Scientific Calculator',total_minor:6500,capacity:5},confirmed_count:0};
  await page.getByLabel('What are you shopping for?').fill('Headphones under $100');await page.getByRole('button',{name:'Find deals',exact:true}).click();
  await expect(page.getByText('We couldn’t evaluate this request. Try again.')).toBeVisible();await expect(page.getByText(/Arc 991|Invalid Date|Highest tier reached|Private model diagnostics/)).toHaveCount(0);
  await page.screenshot({path:`../.impeccable/review/storefront-failed-${info.project.name}.png`,fullPage:true});
  await page.getByRole('link',{name:'My purchases',exact:true}).click();await expect(page.getByText('You haven’t joined a group purchase yet.')).toBeVisible();
});
test('a current headphone deal never invents a reached tier or renders invalid dates',async({page},info)=>{
 const offer={pricing_model:'tiers',product_id:'cabin-one',title:'Cabin One',total_minor:8900,capacity:5,minimum:3,tier_schedule:[{minimum_buyers:3,total_each_cents:8900},{minimum_buyers:5,total_each_cents:8500}],delivery_by:'invalid',close_at:'invalid'};
 await mock(page,{request,group:{...group,status:'OPEN'},products:[],assessments:[{product_id:'cabin-one',eligible:true,available:55,requirements:[]},{product_id:'cabin-pro',eligible:true,available:55,requirements:[]}],rounds:[],negotiation:null,status:{group:{status:"OPEN"},offer,confirmed_count:0,commitment:null},eligible:true,compatible_count:1});await page.goto('/');
 await expect(page.getByRole('heading',{name:'Your group deal'})).toBeVisible();await expect(page.getByText('3 more authorizations to reach $89')).toBeVisible();await expect(page.getByText(/Invalid Date|Highest tier reached/)).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Review deal',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Explore Cabin Pro'}).click();
 await expect(page.locator('#selected-product').getByRole('heading',{name:'Cabin Pro',exact:true})).toBeVisible();
 await expect(page.locator('#selected-product').getByRole('img',{name:'Illustrative photograph of Cabin Pro'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Explore Cabin Pro'})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:`../.impeccable/review/storefront-alternate-${info.project.name}.png`,fullPage:true});
 await page.getByRole('button',{name:'View group deal',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Your group deal'})).toBeVisible();
 await page.route('**/api/requests',route=>route.fulfill({status:503,json:{detail:'Unavailable'}}));
 await page.getByLabel('What are you shopping for?').fill('Headphones under $86');
 await page.getByRole('button',{name:'Find deals',exact:true}).click();
 await expect(page.getByText('We couldn’t evaluate this request. Try again.')).toBeVisible();
 await expect(page.getByText(/Fits your request|Deals that fit your request|Your group deal/)).toHaveCount(0);
 await page.screenshot({path:`../.impeccable/review/storefront-post-failed-${info.project.name}.png`,fullPage:true});
});
