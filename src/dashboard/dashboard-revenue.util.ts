type DashboardAppointmentLike = {
  prepaymentAmount: number | null;
  completedMoneyPaid: number | null;
  service: { id: string; name: string; defaultPrice: number | null };
  serviceItems?: Array<{
    serviceId: string;
    price: number | null;
    service?: { id: string; name: string };
  }>;
  upsells?: Array<{ totalAmount: number }>;
};

/** Сумма основных услуг записи (мультисервис — все serviceItems). */
export function getAppointmentPrimaryServicesRevenue(
  appointment: DashboardAppointmentLike,
): number {
  if (appointment.serviceItems && appointment.serviceItems.length > 0) {
    return appointment.serviceItems.reduce((sum, item) => sum + (item.price ?? 0), 0);
  }
  return appointment.prepaymentAmount ?? appointment.service.defaultPrice ?? 0;
}

/** Доход по завершённой записи: фактическая оплата или услуги + допродажи. */
export function getDoneAppointmentRevenue(appointment: DashboardAppointmentLike): number {
  const upsellTotal =
    appointment.upsells?.reduce((sum, u) => sum + u.totalAmount, 0) ?? 0;
  if (appointment.completedMoneyPaid != null) {
    return appointment.completedMoneyPaid;
  }
  return getAppointmentPrimaryServicesRevenue(appointment) + upsellTotal;
}

export type ServiceStatLine = { serviceId: string; name: string; revenue: number };

/** Разбивка дохода DONE-записи по строкам услуг (для «Популярные услуги»). */
export function getDoneAppointmentServiceStatLines(
  appointment: DashboardAppointmentLike,
): ServiceStatLine[] {
  if (appointment.serviceItems && appointment.serviceItems.length > 0) {
    return appointment.serviceItems.map((item) => ({
      serviceId: item.serviceId,
      name: item.service?.name ?? appointment.service.name,
      revenue: item.price ?? 0,
    }));
  }
  return [
    {
      serviceId: appointment.service.id,
      name: appointment.service.name,
      revenue: appointment.prepaymentAmount ?? appointment.service.defaultPrice ?? 0,
    },
  ];
}
