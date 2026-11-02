"use client";
import Link from "next/link";
import { useCallback,useEffect,useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/hooks/useAuth";
import { automationService } from "@/services/automationService";
import { notificationService } from "@/services/notificationService";
import type { Notification } from "@/types/workflow";
import { formatDate } from "@/utils/formatDate";
const routes:Record<string,string>={lead:"/leads",client:"/clients",project:"/projects",quotation:"/quotations",contract:"/contracts",invoice:"/invoices",expense:"/expenses",maintenance:"/maintenance",ticket:"/maintenance"};
export default function NotificationsPage(){const{user}=useAuth();const[items,setItems]=useState<Notification[]>([]);const[error,setError]=useState("");const[loading,setLoading]=useState(true);const load=useCallback(async()=>{setLoading(true);try{setItems(await notificationService.listUnread(user?.id??null));}catch(e){setError(e instanceof Error?e.message:"Unable to load notifications.");}finally{setLoading(false);}},[user?.id]);useEffect(()=>{void load();},[load]);async function generate(){try{await automationService.expireQuotations(user?.id??null);await automationService.generateNotifications(user?.id??null);await load();}catch(e){setError(e instanceof Error?e.message:"Unable to generate notifications.");}}return <section className="module-page"><div className="module-header"><div><p className="eyebrow">Operations</p><h1>Notifications</h1><p className="muted">{items.length} unread</p></div><div className="module-actions"><Button variant="secondary" onClick={()=>void generate()}>Run manual generator</Button><Button onClick={()=>void notificationService.markAllRead(user?.id??null).then(load)}>Mark all read</Button></div></div>{error?<p className="form-error">{error}</p>:null}{loading?<p>Loading notifications...</p>:items.length===0?<Card><p className="muted">No unread notifications.</p></Card>:items.map(item=><Card key={item.id}><div className="module-header"><div><strong>{item.title}</strong><p>{item.message}</p><small>{formatDate(item.created_at)}{item.due_at?` · Due ${formatDate(item.due_at)}`:""}</small></div><div className="module-actions">{item.entity_type&&item.entity_id?<Link href={`${routes[item.entity_type]??""}/${item.entity_id}`}><Button variant="secondary">Open</Button></Link>:null}<Button onClick={()=>void notificationService.markRead(item.id).then(load)}>Mark read</Button></div></div></Card>)}</section>}

