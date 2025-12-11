
declare const gapi: any;

/* global gapi */

function getErrorMessage(err: any): string {
    if (err?.result?.error?.message) {
        return err.result.error.message;
    }
     if (err.body) { // GAPI often wraps errors in a `body` property
        try {
            const errorDetails = JSON.parse(err.body);
            return errorDetails.error?.message || 'An unknown Google Calendar API error occurred.';
        } catch(e) { /* ignore json parse error */ }
    }
    return err.message || 'An unknown error occurred while communicating with Google Calendar.';
}

/**
 * Lists the user's upcoming events from their primary Google Calendar.
 * @returns A formatted string listing the upcoming events.
 */
export async function listEvents(): Promise<string> {
  try {
    const now = new Date();
    const timeMin = now.toISOString();
    // Get events from now up to 7 days in the future
    const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const response = await gapi.client.calendar.events.list({
      'calendarId': 'primary',
      'timeMin': timeMin,
      'timeMax': timeMax,
      'showDeleted': false,
      'singleEvents': true,
      'maxResults': 10,
      'orderBy': 'startTime'
    });

    const events = response.result.items;
    if (!events || events.length === 0) {
      return 'No upcoming events found in your primary calendar for the next 7 days.';
    }

    const eventList = events.map((event: any) => {
      const start = event.start.dateTime || event.start.date;
      const startDate = new Date(start);
      // Format to "Mon, Jan 1, 3:00 PM" or just the date for all-day events
      const options: Intl.DateTimeFormatOptions = {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: event.start.dateTime ? 'numeric' : undefined,
          minute: event.start.dateTime ? '2-digit' : undefined,
          hour12: true,
      };
      const formattedDate = startDate.toLocaleString([], options);
      return `- **${event.summary}** on ${formattedDate}`;
    }).join('\n');
    
    return `Here are your upcoming events for the next 7 days:\n\n${eventList}`;

  } catch (err: any) {
    console.error("Google Calendar API error:", err);
    throw new Error(getErrorMessage(err));
  }
}
