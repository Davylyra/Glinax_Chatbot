/**
 * Conversation Title Generation Utilities
 * 
 * Provides consistent, professional title generation for all conversations
 * regardless of entry point (university selection, new chat, assessments, etc.)
 */

/**
 * Generate a professional conversation title from the first user message
 * @param firstMessage - The first message sent by the user
 * @param universityContext - Optional university name for context-based titles
 * @param assessmentData - Optional assessment data for assessment-based titles
 * @returns A professional, human-readable conversation title
 */
export function generateConversationTitle(
  firstMessage?: string,
  universityContext?: string,
  assessmentData?: any
): string {
  console.log('🏷️ generateConversationTitle called with:', {
    hasFirstMessage: !!firstMessage,
    firstMessagePreview: firstMessage?.substring(0, 30),
    universityContext,
    hasAssessmentData: !!assessmentData
  });
  
  // Priority 1: Assessment-based title
  if (assessmentData) {
    const interests = assessmentData.interests?.slice(0, 2).join(', ') || 'interests';
    const title = `Assessment: ${interests}`;
    console.log('🏷️ Generated assessment title:', title);
    return title;
  }

  // Priority 2: University context-based title
  if (universityContext) {
    // If we have a first message, combine with university
    if (firstMessage && firstMessage.trim()) {
      const cleanMessage = cleanMessageForTitle(firstMessage);
      if (cleanMessage.length > 5) {
        const title = `${universityContext}: ${cleanMessage}`;
        console.log('🏷️ Generated university + message title:', title);
        return title;
      }
    }
    const title = `${universityContext} Admissions`;
    console.log('🏷️ Generated university-only title (placeholder):', title);
    return title;
  }

  // Priority 3: First message-based title
  if (firstMessage && firstMessage.trim()) {
    const cleanMessage = cleanMessageForTitle(firstMessage);
    if (cleanMessage.length > 5) {
      console.log('🏷️ Generated message-based title:', cleanMessage);
      return cleanMessage;
    }
  }

  // Fallback: Generic title with timestamp for uniqueness
  const hour = new Date().getHours();
  let timeOfDay = 'Morning';
  if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon';
  else if (hour >= 17) timeOfDay = 'Evening';
  
  const title = `${timeOfDay} Consultation`;
  console.log('🏷️ Generated time-based fallback title:', title);
  return title;
}

/**
 * Clean and truncate a message to be used as a conversation title
 * @param message - Raw message text
 * @returns Cleaned, truncated title-appropriate text
 */
function cleanMessageForTitle(message: string): string {
  // Remove excessive whitespace and newlines
  let cleaned = message.replace(/\s+/g, ' ').trim();
  
  // Remove common prefixes that don't add value
  const prefixesToRemove = [
    'tell me about',
    'i want to know about',
    'can you help me with',
    'what is',
    'what are',
    'how do i',
    'how can i',
    'please tell me',
    'i need help with'
  ];
  
  const lowerCleaned = cleaned.toLowerCase();
  for (const prefix of prefixesToRemove) {
    if (lowerCleaned.startsWith(prefix)) {
      cleaned = cleaned.substring(prefix.length).trim();
      // Capitalize first letter after removing prefix
      if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
      break;
    }
  }
  
  // Truncate to reasonable length (max 50 characters)
  if (cleaned.length > 50) {
    // Try to cut at word boundary
    const truncated = cleaned.substring(0, 50);
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 30) {
      cleaned = truncated.substring(0, lastSpace) + '...';
    } else {
      cleaned = truncated + '...';
    }
  }
  
  // Remove trailing punctuation that looks bad in titles
  cleaned = cleaned.replace(/[?!.,;:]+$/, '');
  
  // Ensure first letter is capitalized
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  return cleaned;
}

/**
 * Check if conversation title should be updated with first user message
 * Returns true if current title is generic/placeholder and should be replaced
 * with a message-based title
 * @param currentTitle - Current conversation title
 * @param firstUserMessage - First message from user
 */
export function shouldUpdateConversationTitle(
  currentTitle: string,
  firstUserMessage?: string
): boolean {
  // Don't update if no valid first message
  if (!firstUserMessage || firstUserMessage.trim().length <= 5) {
    console.log('🏷️ shouldUpdateConversationTitle: NO - invalid message', {
      currentTitle,
      messageLength: firstUserMessage?.trim().length || 0
    });
    return false;
  }
  
  // Always update these generic titles
  const alwaysUpdateTitles = [
    'New Chat',
    'Morning Consultation',
    'Afternoon Consultation', 
    'Evening Consultation',
    'Untitled',
    'Conversation'
  ];
  
  if (alwaysUpdateTitles.includes(currentTitle)) {
    console.log('🏷️ shouldUpdateConversationTitle: YES - generic title', currentTitle);
    return true;
  }
  
  // Update university-only titles (e.g., "KNUST Admissions", "UG Admissions")
  // These are placeholders that should be replaced with message-based titles
  if (currentTitle.endsWith(' Admissions')) {
    console.log('🏷️ shouldUpdateConversationTitle: YES - university placeholder', currentTitle);
    return true;
  }
  
  // Update assessment-only titles (e.g., "Assessment: Computer Science, Medicine")
  // when user sends first real message (not from assessment flow)
  if (currentTitle.startsWith('Assessment: ')) {
    console.log('🏷️ shouldUpdateConversationTitle: YES - assessment placeholder', currentTitle);
    return true;
  }
  
  // Don't update titles that already look message-based
  // (e.g., "KNUST: Scholarship opportunities" or "Cut off points")
  console.log('🏷️ shouldUpdateConversationTitle: NO - already has good title', currentTitle);
  return false;
}
