"use client";

import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Inbox, Send, LayoutTemplate, Settings, Icon as LucideIcon } from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

const features: FeatureCardProps[] = [
  {
    title: "Inbox",
    description: "Gestiona todas tus conversaciones de WhatsApp en un solo lugar.",
    icon: Inbox,
    href: "/inbox",
  },
  {
    title: "Envíos Masivos",
    description: "Envía mensajes a múltiples contactos de forma eficiente.",
    icon: Send,
    href: "/broadcasts",
  },
  {
    title: "Plantillas",
    description: "Crea y administra plantillas de mensajes para respuestas rápidas.",
    icon: LayoutTemplate,
    href: "/templates",
  },
  {
    title: "Configuración",
    description: "Ajusta la configuración de tu cuenta y preferencias.",
    icon: Settings,
    href: "/settings",
  },
];

const FeatureCard = ({ title, description, icon: Icon, href }: FeatureCardProps) => (
  <Card className="flex flex-col justify-between h-full">
    <CardHeader className="flex flex-row items-center space-x-4 pb-2">
      <div className="p-2 bg-primary/10 rounded-md">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <CardTitle className="text-xl">{title}</CardTitle>
    </CardHeader>
    <CardContent className="flex-grow">
      <CardDescription className="text-base">{description}</CardDescription>
    </CardContent>
    <div className="p-6 pt-0">
      <Link to={href}>
        <Button className="w-full">Ir a {title}</Button>
      </Link>
    </div>
  </Card>
);

const FeatureCards = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8 w-full max-w-6xl">
      {features.map((feature, index) => (
        <FeatureCard key={index} {...feature} />
      ))}
    </div>
  );
};

export default FeatureCards;