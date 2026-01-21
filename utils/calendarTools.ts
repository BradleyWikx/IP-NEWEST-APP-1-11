
import { Reservation } from '../types';

export const generateGoogleCalendarUrl = (reservation: Reservation): string => {
  const { date, startTime, showId } = reservation;
  
  // Construct Start Time (Assume 2.5 hours duration if unknown)
  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(start.getTime() + 2.5 * 60 * 60 * 1000);

  const formatDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: 'Inspiration Point: Dinner Show',
    dates: `${formatDate(start)}/${formatDate(end)}`,
    details: `Reservering: ${reservation.id}\nAantal: ${reservation.partySize} personen\nShow: ${showId}`,
    location: 'Dorpstraat 1, 1234 AB Utrecht',
    sprop: 'website:inspirationpoint.nl'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

export const downloadIcsFile = (reservation: Reservation) => {
  const { date, startTime } = reservation;
  
  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(start.getTime() + 2.5 * 60 * 60 * 1000);
  
  const formatDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Inspiration Point//Reservations//NL
BEGIN:VEVENT
UID:${reservation.id}@inspirationpoint.nl
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(start)}
DTEND:${formatDate(end)}
SUMMARY:Inspiration Point: Dinner Show
DESCRIPTION:Reservering: ${reservation.id} - ${reservation.partySize} personen
LOCATION:Dorpstraat 1, 1234 AB Utrecht
END:VEVENT
END:VCALENDAR`;

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute('download', `reservation-${reservation.id}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
