import catalogue from "./services.json";

export interface Service {
  id: string;
  name: string;
  tag: string;
  description: string;
  url: string;
  accent: string;
  icon: string;
  category: string;
}

export const SERVICES: readonly Service[] = catalogue.services;

export interface ServiceCategory {
  name: string;
  services: Service[];
}

export const SERVICE_CATEGORIES: readonly ServiceCategory[] = (() => {
  const groups: ServiceCategory[] = [];
  const byName = new Map<string, ServiceCategory>();
  for (const service of SERVICES) {
    let group = byName.get(service.category);
    if (!group) {
      group = { name: service.category, services: [] };
      byName.set(service.category, group);
      groups.push(group);
    }
    group.services.push(service);
  }
  return groups;
})();

export function findService(id: string): Service | undefined {
  return SERVICES.find((service) => service.id === id);
}
