import express from "express";
import multer from "multer";
import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";
import { getCollection } from "../config/db.js";
import { ObjectId } from "mongodb";
import authMiddleware from "../middleware/authMiddleware.js";
import { logConversationMiddleware, logAssessment } from "../middleware/conversationLogger.js";
import { cacheMiddleware, cacheManager } from "../middleware/cacheManager.js";
import { rateLimiters } from "../middleware/rateLimiter.js";
import { validateChatPayload } from "../middleware/inputValidation.js";
import { generateTitleWithFallback } from "../utils/llmTitleGenerator.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Multer setup for file uploads
const upload = multer({ dest: "uploads/" });

// Python RAG endpoint
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000/respond";

// 📎 File upload endpoint for chat with attachments
router.post("/upload", upload.array('files', 5), async (req, res) => {
  try {
    const { message, conversation_id, university_name } = req.body;
    const userId = req.user?.id || 'demo_user';
    const files = req.files || [];

    console.log('📎 Processing message with files:', {
      message: message?.substring(0, 100),
      fileCount: files.length,
      conversation_id,
      university_name
    });

    if (!message && files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Either message or files are required"
      });
    }

    // Get MongoDB collections
    const messagesCollection = await getCollection('messages');

    // Process uploaded files
    const fileAttachments = files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path
    }));

    // Create message text including file information
    let messageText = message || '';
    if (files.length > 0) {
      const fileInfo = files.map(f => `📎 ${f.originalname} (${(f.size/1024).toFixed(1)}KB)`).join('\n');
      messageText = message ? `${message}\n\n${fileInfo}` : fileInfo;
    }

    // Save user message with attachments to MongoDB (store IDs as strings)
    const userMessage = {
      user_id: userId,
      conversation_id: conversation_id,
      message: messageText,
      is_bot: false,
      created_at: new Date(),
      timestamp: new Date().toISOString(),
      attachments: fileAttachments
    };

    await messagesCollection.insertOne(userMessage);
    console.log('✅ Saved user message with files to MongoDB');

    // Prepare enhanced RAG request with file information
    const ragRequest = {
      message: message || `User sent ${files.length} file(s)`,
      conversation_id: conversation_id,
      university_name: university_name || null,
      files: fileAttachments,
      user_context: {
        user_id: userId,
        preferred_university: university_name,
        has_attachments: files.length > 0,
        file_types: files.map(f => f.mimetype)
      }
    };

    console.log('🔍 Sending message with files to RAG service...');

    // FIXED: Send files to the new RAG service endpoint
    const formData = new FormData();
    formData.append('message', message || `User sent ${files.length} file(s)`);
    formData.append('conversation_id', conversation_id);
    formData.append('university_name', university_name || '');
    formData.append('user_context', JSON.stringify({
      user_id: userId,
      preferred_university: university_name,
      has_attachments: files.length > 0,
      file_types: files.map(f => f.mimetype)
    }));

    // Add actual file data with proper field name
    files.forEach((file) => {
      formData.append('files', fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype
      });
    });

    console.log('🔍 Sending files to enhanced RAG service endpoint...');

    // Send to the new file-handling endpoint
    const fileEndpoint = AI_SERVICE_URL.replace('/respond', '/respond-with-files');
    console.log('📤 Using file endpoint:', fileEndpoint);

    const ragResponse = await fetch(fileEndpoint, {
      method: 'POST',
      headers: {
        "x-user-id": userId,
      },
      body: formData,
      timeout: 60000 // Longer timeout for file processing
    });

    const ragData = await ragResponse.json();
    console.log('📥 RAG service response for files received:', {
      confidence: ragData.confidence,
      sources_count: ragData.sources?.length || 0,
      response_length: ragData.reply?.length || 0
    });

    // Save AI response to MongoDB
    const aiMessage = {
      user_id: userId === 'demo_user' ? userId : new ObjectId(userId),
      conversation_id: conversation_id,
      message: ragData.reply || 'I received your files but had trouble processing them.',
      is_bot: true,
      created_at: new Date(),
      timestamp: ragData.timestamp || new Date().toISOString(),
      sources: ragData.sources || [],
      confidence: ragData.confidence || 0.0,
      rag_metadata: {
        source_count: ragData.sources?.length || 0,
        processing_time: ragData.processing_time,
        model_used: ragData.model_used || 'hybrid-rag',
        processed_files: files.length
      }
    };

    await messagesCollection.insertOne(aiMessage);
    console.log('✅ Saved AI response for files to MongoDB');

    // Clean up uploaded files
    files.forEach(file => {
      try {
        fs.unlinkSync(file.path);
      } catch (err) {
        console.warn('⚠️ Could not delete uploaded file:', file.path);
      }
    });

    // Return enhanced response
    res.json({
      success: true,
      message: ragData.reply || 'Files processed successfully',
      reply: ragData.reply || 'Files processed successfully',
      conversation_id: conversation_id,
      sources: ragData.sources || [],
      confidence: ragData.confidence || 0.0,
      timestamp: ragData.timestamp || new Date().toISOString(),
      files_processed: files.length,
      metadata: {
        university_context: university_name,
        response_type: ragData.confidence > 0.85 ? 'local_knowledge' : 'hybrid_search',
        processing_info: ragData.processing_info,
        attachments: fileAttachments
      }
    });

  } catch (error) {
    console.error("❌ File upload processing error:", error);
    
    const errorMessage = error.code === 'ECONNREFUSED'
      ? "The AI service is not responding right now. Please try again later."
      : "There was an issue processing your files. Please try again or contact support.";

    res.status(500).json({ 
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      conversation_id: req.body.conversation_id
    });
  }
});

// Demo chat endpoint (no authentication required) - Enhanced with caching and logging
router.post("/demo", cacheMiddleware, logConversationMiddleware, async (req, res) => {
  try {
    const { message, conversation_id } = req.body;

    console.log(`📥 Demo message: ${message?.substring(0, 100)}...`);

    if (!message || !conversation_id) {
      return res.status(400).json({
        success: false,
        message: "Message and conversation_id are required"
      });
    }

    // Send directly to RAG service for demo
    console.log(`🤖 Sending demo request to: ${AI_SERVICE_URL}`);
    
    try {
      const response = await fetch(AI_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message,
          conversation_id: conversation_id,
          user_context: {
            user_id: 'demo_user',
            demo_mode: true,
            timestamp: new Date().toISOString()
          }
        })
      });

      const data = await response.json();
      console.log("✅ Demo response received from RAG service");

      res.json({
        success: true,
        reply: data.reply || "I'm here to help with Ghanaian university information!",
        sources: data.sources || [],
        confidence: data.confidence || 0.5,
        processing_time: data.processing_time || 0,
        demo_mode: true
      });

    } catch (ragError) {
      console.error("❌ Demo RAG Service Error:", ragError.message);
      
      // Intelligent fallback for demo
      const fallbackReply = generateQuickFallback(message);
      
      res.json({
        success: true,
        reply: fallbackReply,
        sources: [{"source": "Local Knowledge", "type": "fallback"}],
        confidence: 0.3,
        demo_mode: true
      });
    }

  } catch (error) {
    console.error("❌ Demo Chat Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process your message. Please try again.",
      demo_mode: true
    });
  }
});

function generateQuickFallback(message) {
  const messageLower = message?.toLowerCase() || '';
  
  // Check for assessment data in message
  if (messageLower.includes('assessment') || messageLower.includes('grades') || messageLower.includes('career goals')) {
    return `**🎯 Assessment Results Analysis**

Thank you for sharing your academic profile! Based on your information, here are some recommendations:

**🏫 Recommended Universities:**
• **University of Ghana (Legon)** - Excellent for your academic profile
• **KNUST (Kumasi)** - Strong in technology and engineering
• **UCC (Cape Coast)** - Good alternative with quality programs

**📚 Suggested Programs:**
• Computer Science (UG/KNUST)
• Software Engineering (KNUST) 
• Information Technology (UCC)

**💡 Next Steps:**
1. Research specific program requirements
2. Visit university websites for application details
3. Prepare application documents
4. Apply before deadlines (usually March-April)

Would you like detailed information about any specific university or program?`;
  }
  
  if (messageLower.includes('university of ghana') || messageLower.includes('ug')) {
    return `**University of Ghana (Legon) 🎓**

**📍 Location:** Legon, Accra
**📞 Contact:** +233-30-213-8501
**✉️ Email:** admissions@ug.edu.gh
**🌐 Website:** www.ug.edu.gh

**Popular Programs:**
• Computer Science - 4 years, GHS 8,500/year
• Medicine - 6 years, GHS 15,000/year
• Business Admin - 4 years, GHS 6,500/year

**Requirements:** WASSCE with 6 credits (A1-C6)
**Deadline:** March 31st | **Fee:** GHS 200

Need specific program details? Just ask!`;
  }
  
  return `**Welcome to Glinax! 🎓**

I help with Ghanaian university admissions:

**🏫 Universities:** UG, KNUST, UCC, UDS, UPSA
**📚 Info:** Programs, fees, requirements, deadlines
**💬 Try:** "Tell me about Computer Science at UG"

What can I help you find?`;
}

/**
 * Start a new conversation
 */
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title } = req.body;
    const userId = req.user.id;
    const conversationsCollection = await getCollection("conversations");

    const newConversation = {
      user_id: new ObjectId(userId),
      title: title || "New Conversation",
      created_at: new Date(),
      updated_at: new Date()
    };

    const result = await conversationsCollection.insertOne(newConversation);
    
    const conversation = {
      id: result.insertedId.toString(),
      user_id: userId,
      title: newConversation.title,
      created_at: newConversation.created_at,
      updated_at: newConversation.updated_at
    };

    res.status(201).json({ conversation });
  } catch (err) {
    console.error("❌ Error creating conversation:", err);
    res.status(500).json({ message: "Failed to start new conversation" });
  }
});

/**
 * Send a message (or file) and get AI response
 */
router.post(
  "/respond",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    const { message, conversation_id } = req.body;
    const file = req.file;
    const userId = req.user.id;

    if (!message && !file)
      return res.status(400).json({ message: "Provide either a message or a file" });

    try {
      const conversationsCollection = await getCollection("conversations");
      
      // Try to find the conversation
      const convoCheck = await conversationsCollection.findOne({
        _id: new ObjectId(conversation_id),
        user_id: new ObjectId(userId)
      });
      
      
      if (!convoCheck) {
        console.log("⚠️ WARNING: Chat ID not found in DB, proceeding anyway for demo.");
      }
      // -----------------------------------------------------

      let aiResponse;

      if (file) {
        const formData = new FormData();
        formData.append("conversation_id", conversation_id);
        formData.append("message", message || "");
        formData.append("file", fs.createReadStream(file.path));

        aiResponse = await fetch(`${AI_SERVICE_URL}`, {
          method: "POST",
          headers: { "x-user-id": userId.toString() },
          body: formData,
        });

        // Clean up uploaded file
        try { fs.unlinkSync(file.path); } catch (e) { console.error("Error deleting file:", e); }

      } else {
        aiResponse = await fetch(`${AI_SERVICE_URL}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId.toString(),
          },
          body: JSON.stringify({ conversation_id, message }),
        });
      }

      // Safely handle text or JSON replies
      const aiResponseText = await aiResponse.text();
      let data;
      try {
        data = JSON.parse(aiResponseText);
      } catch {
        data = { reply: aiResponseText };
      }

      const aiMessage = data.reply || "Sorry, I couldn’t process that.";

      const messagesCollection = await getCollection("messages");
      
      // Save user message
      if (message) {
        await chatsCollection.insertOne({
          user_id: new ObjectId(userId),
          conversation_id: new ObjectId(conversation_id),
          message,
          is_bot: false,
          created_at: new Date()
        });
      }

      if (file) {
        await chatsCollection.insertOne({
          user_id: new ObjectId(userId),
          conversation_id: new ObjectId(conversation_id),
          message: `📎 Uploaded file: ${file.originalname}`,
          is_bot: false,
          created_at: new Date()
        });
      }

      // Save Bot message
      await chatsCollection.insertOne({
        user_id: new ObjectId(userId),
        conversation_id: new ObjectId(conversation_id),
        message: aiMessage,
        is_bot: true,
        created_at: new Date()
      });

      res.json({ reply: aiMessage });

    } catch (err) {
      console.error("❌ Chat error:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
);


/**
 * Get all user conversations
 */
router.get("/user/all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationsCollection = await getCollection("conversations");
    
    const conversations = await conversationsCollection
      .find({ user_id: new ObjectId(userId) })
      .sort({ created_at: -1 })
      .toArray();
    
    const formattedConversations = conversations.map(conv => ({
      id: conv._id.toString(),
      user_id: conv.user_id.toString(),
      title: conv.title,
      created_at: conv.created_at,
      updated_at: conv.updated_at
    }));
    
    res.json({ conversations: formattedConversations });
  } catch (err) {
    console.error("❌ Error fetching conversations:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Get paginated chat history
 */
router.get("/history/:conversation_id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversation_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const messagesCollection = await getCollection("messages");

    // Build robust filter that supports string IDs and ObjectId values
    const userIdCandidates = [userId];
    if (/^[a-fA-F0-9]{24}$/.test(userId)) {
      try { userIdCandidates.push(new ObjectId(userId)); } catch (e) {}
    }

    const conversationIdCandidates = [conversation_id];
    if (/^[a-fA-F0-9]{24}$/.test(conversation_id)) {
      try { conversationIdCandidates.push(new ObjectId(conversation_id)); } catch (e) {}
    }

    const filter = {
      user_id: { $in: userIdCandidates },
      conversation_id: { $in: conversationIdCandidates }
    };

    const total = await messagesCollection.countDocuments(filter);

    const chats = await messagesCollection
      .find(filter)
      .sort({ sequence: 1, created_at: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const formattedChats = chats.map(chat => ({
      id: chat._id.toString(),
      user_id: String(chat.user_id || ''),
      conversation_id: String(chat.conversation_id || ''),
      message: chat.message,
      is_bot: !!chat.is_bot,
      created_at: chat.created_at
    }));

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      chats: formattedChats,
    });
  } catch (err) {
    console.error("❌ Error fetching chat history:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Save conversation and messages to MongoDB
 * Now with integrated LLM title generation
 */
router.post("/save-conversation", async (req, res) => {
  try {
    const { conversation, messages, userId } = req.body;
    
    if (!conversation || !messages) {
      return res.status(400).json({ 
        success: false, 
        message: "Conversation and messages are required" 
      });
    }

    const conversationsCollection = await getCollection("conversations");
    const messagesCollection = await getCollection("messages");

    // Use provided userId or fallback to "demo_user"
    const actualUserId = userId || "demo_user";

    // 🏷️ SMART TITLE GENERATION: Generate LLM-powered title if conversation has messages
    let finalTitle = conversation.title || 'Untitled';
    let titleMethod = 'provided';
    
    // Generate title only if we have at least one user message and one bot reply
    if (messages.length >= 2) {
      const firstUserMessage = messages.find(m => m.isUser === true || m.sender === 'user');
      const firstBotReply = messages.find(m => m.isUser === false || m.sender === 'bot');
      
      if (firstUserMessage && firstBotReply) {
        console.log('🏷️ [SAVE] Generating LLM title for conversation...');
        
        try {
          const titleResult = await generateTitleWithFallback(
            firstUserMessage.text || firstUserMessage.message || '',
            firstBotReply.text || firstBotReply.message || '',
            conversation.universityContext || null,
            // Fallback function
            () => conversation.title || 'University Consultation'
          );
          
          finalTitle = titleResult.title;
          titleMethod = titleResult.method;
          console.log(`✅ [SAVE] Generated title: "${finalTitle}" (method: ${titleMethod})`);
        } catch (titleError) {
          console.warn('⚠️ [SAVE] Title generation failed, using original title:', titleError.message);
          // Keep original title on error
        }
      }
    }

    // Create proper conversation document for MongoDB
    const conversationDoc = {
      _id: conversation.id, // Use the conversation ID as-is (string format: conv_TIMESTAMP)
      title: finalTitle,
      title_method: titleMethod,
      title_generated_at: new Date(),
      last_message: conversation.lastMessage || '',
      created_at: conversation.timestamp ? new Date(conversation.timestamp) : new Date(),
      updated_at: new Date(),
      message_count: messages.length,
      university_context: conversation.universityContext || null,
      user_id: actualUserId // Store the actual user ID, not hardcoded
    };

    console.log(`💾 [SAVE] Saving conversation with _id (type: ${typeof conversation.id}): ${conversation.id}`);

    // Save or update conversation
    await conversationsCollection.replaceOne(
      { _id: conversation.id },
      conversationDoc,
      { upsert: true }
    );

    console.log(`✅ [SAVE] Conversation upserted with _id: ${conversation.id}, title: "${finalTitle}"`);

    // CRITICAL FIX: Delete all existing messages for this conversation BEFORE saving new ones
    // This prevents duplicate messages when the same conversation is saved multiple times
    console.log(`🧹 [SAVE] Clearing existing messages for conversation ${conversation.id}`);
    const deleteResult = await messagesCollection.deleteMany({
      conversation_id: conversation.id,
      user_id: actualUserId
    });
    console.log(`🗑️ [SAVE] Deleted ${deleteResult.deletedCount} existing messages`);

    // Save messages to messages collection - now guaranteed to be fresh without duplicates
    const messagePromises = messages.map(async (message, index) => {
      try {
        const messageDoc = {
          conversation_id: conversation.id,
          message: message.text || message || '',
          is_bot: message.isUser === false || message.sender === 'bot',
          created_at: message.timestamp ? new Date(message.timestamp) : new Date(),
          timestamp: message.timestamp || new Date().toISOString(),
          sources: message.sources || [],
          confidence: message.confidence || 0,
          user_id: actualUserId,
          // Add sequence number to maintain order
          sequence: index
        };

        // Insert fresh message (no upsert needed since we deleted all existing ones)
        await messagesCollection.insertOne(messageDoc);
      } catch (msgError) {
        console.warn(`⚠️ Error saving individual message:`, msgError.message);
        // Continue with other messages even if one fails
      }
    });

    await Promise.all(messagePromises);

    console.log(`✅ [SAVE] Conversation ${conversation.id} with ${messages.length} messages saved for user ${actualUserId}`);
    res.json({ 
      success: true, 
      message: "Conversation saved successfully",
      conversation_id: conversation.id,
      saved_messages: messages.length,
      title: finalTitle,
      title_method: titleMethod
    });

  } catch (error) {
    console.error("❌ Error saving conversation to MongoDB:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to save conversation to MongoDB",
      error: error.message 
    });
  }
});

/**
 * Get conversation history for authenticated users - FIXED
 */
router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const conversationsCollection = await getCollection("conversations");

    // Prevent browser caching to ensure fresh data is always loaded
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    console.log(`🔍 [GET] Fetching conversations for user: ${userId}`);

    // Get user's conversations - handle both ObjectId and string user_ids
    const conversations = await conversationsCollection
      .find({
        $or: [
          { user_id: userId }, // String comparison
          { user_id: new ObjectId(userId) } // ObjectId comparison
        ]
      })
      .sort({ updated_at: -1 })
      .limit(100)
      .toArray();

    console.log(`✅ [GET] Retrieved ${conversations.length} conversations for user ${userId}`);
    
    // Log conversation IDs for debugging
    if (conversations.length > 0) {
      console.log(`📋 [GET] Conversation IDs: ${conversations.map(c => `${c._id} (type: ${typeof c._id})`).join(', ')}`);
    }

    // If no conversations found for authenticated user, return empty array
    if (conversations.length === 0) {
      return res.json({
        success: true,
        conversations: []
      });
    }

    // FIXED: Ensure field name consistency with frontend expectations
    res.json({
      success: true,
      conversations: conversations.map(conv => ({
        id: conv._id?.toString() || conv.id || String(conv._id),
        title: conv.title || 'Untitled Conversation',
        lastMessage: conv.last_message || conv.lastMessage || '',
        timestamp: conv.updated_at?.toISOString() || conv.created_at?.toISOString() || new Date().toISOString(),
        messageCount: conv.message_count || conv.messageCount || 0,
        universityContext: conv.university_context || conv.universityContext || null,
        // Include both field names for backward compatibility
        last_message: conv.last_message || conv.lastMessage || '',
        message_count: conv.message_count || conv.messageCount || 0,
        university_context: conv.university_context || conv.universityContext || null
      }))
    });

  } catch (error) {
    console.error("❌ Error fetching conversations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conversations",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Get conversation history for demo/guest users
 */
router.get("/conversations-demo", async (req, res) => {
  try {
    const conversationsCollection = await getCollection("conversations");
    
    // Get recent conversations for demo
    const conversations = await conversationsCollection
      .find({})
      .sort({ updated_at: -1 })
      .limit(20)
      .toArray();

    console.log(`✅ Retrieved ${conversations.length} demo conversations`);
    // FIXED: Consistent field mapping and proper ISO timestamp conversion
    res.json({ 
      success: true, 
      conversations: conversations.map(conv => ({
        id: conv._id?.toString() || String(conv._id),
        title: conv.title || 'Untitled Conversation',
        lastMessage: conv.last_message || conv.lastMessage || '',
        timestamp: conv.updated_at?.toISOString() || conv.created_at?.toISOString() || new Date().toISOString(),
        messageCount: conv.message_count || conv.messageCount || 0,
        universityContext: conv.university_context || conv.universityContext || null
      }))
    });

  } catch (error) {
    console.error("❌ Error fetching demo conversations:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch conversations" 
    });
  }
});

/**
 * Get messages for a specific conversation - SECURE VERSION
 */
router.get("/conversations/:conversation_id/messages", authMiddleware, async (req, res) => {
  try {
    const { conversation_id } = req.params;
    const userId = req.user.id;
    const messagesCollection = await getCollection("messages");

    // Prevent caching to ensure fresh messages
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    console.log(`🔍 Fetching messages for conversation: ${conversation_id} (user: ${userId})`);

    // SECURITY FIX: Filter by both conversation_id AND user_id (support string/ObjectId)
    const userIdCandidates2 = [userId];
    if (/^[a-fA-F0-9]{24}$/.test(userId)) {
      try { userIdCandidates2.push(new ObjectId(userId)); } catch (e) {}
    }

    const convIdCandidates2 = [conversation_id];
    if (/^[a-fA-F0-9]{24}$/.test(conversation_id)) {
      try { convIdCandidates2.push(new ObjectId(conversation_id)); } catch (e) {}
    }

    const messages = await messagesCollection
      .find({
        conversation_id: { $in: convIdCandidates2 },
        user_id: { $in: userIdCandidates2 }
      })
      .sort({ sequence: 1, created_at: 1 })
      .toArray();

    console.log(`✅ Retrieved ${messages.length} raw messages for conversation ${conversation_id} (user: ${userId})`);

    // CRITICAL: Deduplicate messages in case there are database duplicates
    const dedupedMessages = [];
    const seenSignatures = new Set();
    
    for (const msg of messages) {
      // Create signature for deduplication: conversation_id + is_bot + message + timestamp (to second)
      const timestamp = msg.created_at || msg.timestamp;
      const timestampSec = timestamp ? Math.floor(new Date(timestamp).getTime() / 1000) : 0;
      const signature = `${conversation_id}|${msg.is_bot}|${msg.message}|${timestampSec}`;
      
      if (!seenSignatures.has(signature)) {
        seenSignatures.add(signature);
        dedupedMessages.push(msg);
      } else {
        console.warn(`⚠️ [DEDUP] Skipping duplicate message: ${msg.message?.substring(0, 50)}...`);
      }
    }

    if (dedupedMessages.length < messages.length) {
      console.warn(`⚠️ [DEDUP] Removed ${messages.length - dedupedMessages.length} duplicate messages`);
    }

    res.json({
      success: true,
      messages: dedupedMessages.map(msg => ({
        id: msg._id?.toString() || String(msg._id),
        text: msg.message || '',
        isUser: !msg.is_bot,
        timestamp: msg.timestamp || msg.created_at?.toISOString() || new Date().toISOString(),
        conversationId: msg.conversation_id,
        sources: msg.sources || [],
        confidence: msg.confidence || 0,
        attachments: msg.attachments || []
      }))
    });

  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Clear chat history (messages only)
 */
router.delete("/:conversation_id/clear", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversation_id } = req.params;
    const messagesCollection = await getCollection("messages");

    // Delete messages matching either string or ObjectId ids
    const deleteFilter = { user_id: userId, conversation_id };
    await messagesCollection.deleteMany(deleteFilter);

    res.json({ 
      success: true,
      message: "Chat history cleared successfully" 
    });
  } catch (err) {
    console.error("❌ Error clearing chats:", err);
    res.status(500).json({ 
      success: false,
      message: "Server error" 
    });
  }
});

/**
 * Delete conversation entirely (conversation + all messages)
 * CRITICAL: Conversation IDs are stored as strings (conv_TIMESTAMP), not ObjectIds
 */
router.delete("/:conversation_id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { conversation_id } = req.params;
    const messagesCollection = await getCollection("messages");
    const conversationsCollection = await getCollection("conversations");

    // Prevent caching of delete operations
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    console.log(`🗑️ [DELETE] Starting deletion of conversation ${conversation_id} for user ${userId}`);

    // Delete all messages in this conversation
    const messagesResult = await messagesCollection.deleteMany({ 
      user_id: userId, 
      conversation_id 
    });
    console.log(`📝 [DELETE] Deleted ${messagesResult.deletedCount} messages for conversation ${conversation_id}`);

    // Delete the conversation metadata
    // IMPORTANT: Conversations are stored with _id as STRING (e.g., 'conv_1734556789123')
    // NOT as MongoDB ObjectId. Query by string ID directly.
    let conversationResult = { deletedCount: 0 };
    
    // First try string ID (this should work)
    conversationResult = await conversationsCollection.deleteOne({
      _id: conversation_id,
      user_id: userId
    });
    console.log(`💾 [DELETE] Query by string ID: ${conversation_id}, deleted: ${conversationResult.deletedCount}`);
    
    // If string ID didn't work, try ObjectId (in case some are stored as ObjectId)
    if (conversationResult.deletedCount === 0 && /^[a-fA-F0-9]{24}$/.test(conversation_id)) {
      console.log(`🔄 [DELETE] String ID query returned 0, trying ObjectId format...`);
      try {
        const conversationObjectId = new ObjectId(conversation_id);
        conversationResult = await conversationsCollection.deleteOne({
          _id: conversationObjectId,
          user_id: userId
        });
        console.log(`💾 [DELETE] Query by ObjectId: ${conversation_id}, deleted: ${conversationResult.deletedCount}`);
      } catch (objectIdError) {
        console.log(`⚠️ [DELETE] ObjectId conversion failed: ${objectIdError.message}`);
      }
    }

    // Log final result
    if (conversationResult.deletedCount === 0) {
      console.warn(`⚠️ [DELETE] WARNING: Conversation ${conversation_id} not found for user ${userId}`);
      console.warn(`⚠️ [DELETE] This may indicate the conversation was already deleted or doesn't exist`);
    } else {
      console.log(`✅ [DELETE] Successfully deleted conversation metadata`);
    }

    console.log(`✅ [DELETE] COMPLETE: Deleted ${messagesResult.deletedCount} messages and ${conversationResult.deletedCount} conversation records for ${conversation_id}`);

    res.json({ 
      success: true,
      message: "Conversation deleted successfully",
      deletedMessages: messagesResult.deletedCount,
      deletedConversation: conversationResult.deletedCount
    });
  } catch (err) {
    console.error("❌ Error deleting conversation:", err);
    res.status(500).json({ 
      success: false,
      message: "Failed to delete conversation" 
    });
  }
});

/**
 * Send message - Enhanced RAG+CAG endpoint (for frontend compatibility)
 */
// FIXED: Enhanced endpoint for authenticated users  
router.post("/send", authMiddleware, rateLimiters.chatRateLimit, validateChatPayload, async (req, res) => {
  try {
    const { message, conversation_id, university_name } = req.body;
    const userId = req.user.id;

    if (!message || !conversation_id) {
      return res.status(400).json({ 
        success: false,
        message: "Message and conversation_id are required" 
      });
    }

    // Get MongoDB collections
    const messagesCollection = await getCollection('messages');

    // Save user message (store ids as strings)
    const userMessage = {
      user_id: userId,
      conversation_id: conversation_id,
      message: message,
      is_bot: false,
      created_at: new Date(),
      timestamp: new Date().toISOString()
    };

    await messagesCollection.insertOne(userMessage);

    // Prepare RAG request
    const ragRequest = {
      message: message,
      conversation_id: conversation_id,
      university_name: university_name || null,
      user_context: {
        user_id: userId,
        preferred_university: university_name,
        timestamp: new Date().toISOString()
      }
    };

    // Send to RAG service
    const ragResponse = await fetch(AI_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify(ragRequest),
    });

    // Check if RAG service is available
    if (!ragResponse.ok) {
      console.error(`❌ RAG service error: ${ragResponse.status} ${ragResponse.statusText}`);
      return res.status(503).json({
        success: false,
        message: "AI service is temporarily unavailable. Please try again later.",
        conversation_id: conversation_id
      });
    }

    const ragData = await ragResponse.json();

    // Save AI response
    const aiMessage = {
      user_id: userId,
      conversation_id: conversation_id,
      message: ragData.reply,
      is_bot: true,
      created_at: new Date(),
      timestamp: ragData.timestamp || new Date().toISOString(),
      sources: ragData.sources || [],
      confidence: ragData.confidence || 0.0
    };

    await messagesCollection.insertOne(aiMessage);

    // Return response
    res.json({
      success: true,
      message: ragData.reply,
      reply: ragData.reply,
      conversation_id: conversation_id,
      sources: ragData.sources || [],
      confidence: ragData.confidence || 0.0,
      timestamp: ragData.timestamp || new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Authenticated chat error:", error);
    res.status(500).json({ 
      success: false,
      message: "I'm having some technical issues right now. Please try again.",
      conversation_id: req.body.conversation_id
    });
  }
});

// Demo endpoint (no authentication required)
router.post("/send-message-demo", async (req, res) => {
  try {
    const { message, conversation_id, university_name } = req.body;
    const userId = req.user?.id || "demo-user";

    if (!message || !conversation_id) {
      return res.status(400).json({ 
        success: false,
        message: "Message and conversation_id are required" 
      });
    }

    // Prepare RAG request
    const ragRequest = {
      message: message,
      conversation_id: conversation_id,
      university_name: university_name || null,
      user_context: {
        user_id: userId,
        preferred_university: university_name
      }
    };

    // Send to RAG service
    const ragResponse = await fetch(AI_SERVICE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
      },
      body: JSON.stringify(ragRequest),
    });

    const ragData = await ragResponse.json();

    // Save messages to MongoDB (store ids as strings)
    const messagesCollection = await getCollection("messages");

    // Save user message
    await messagesCollection.insertOne({
      user_id: userId,
      conversation_id: conversation_id,
      message: message,
      is_bot: false,
      created_at: new Date(),
      timestamp: new Date().toISOString()
    });

    // Save AI response
    await messagesCollection.insertOne({
      user_id: userId,
      conversation_id: conversation_id,
      message: ragData.reply,
      is_bot: true,
      created_at: new Date(),
      timestamp: ragData.timestamp || new Date().toISOString(),
      sources: ragData.sources || [],
      confidence: ragData.confidence || 0.0
    });

    // Return response
    res.json({
      success: true,
      message: ragData.reply,
      reply: ragData.reply,
      conversation_id: conversation_id,
      sources: ragData.sources || [],
      confidence: ragData.confidence || 0.0,
      timestamp: ragData.timestamp || new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Chat error:", error);
    res.status(500).json({ 
      success: false,
      message: "I'm having some technical issues right now. Please try again.",
      conversation_id: req.body.conversation_id
    });
  }
});

// 🏷️ Generate LLM-powered title for conversation
// Called after first exchange (user message + bot reply)
router.post("/conversations/:id/generate-title", async (req, res) => {
  try {
    const conversationId = req.params.id;
    const { firstUserMessage, firstBotReply, universityContext, fallbackTitle } = req.body;

    console.log('🏷️ Generating LLM title for conversation:', conversationId);

    // Validate input
    if (!firstUserMessage || firstUserMessage.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error: 'First user message is required and must be at least 5 characters'
      });
    }

    // Generate title with LLM (with automatic fallback)
    const result = await generateTitleWithFallback(
      firstUserMessage,
      firstBotReply,
      universityContext,
      // Fallback function: just return the provided fallback title if available
      () => fallbackTitle || firstUserMessage.substring(0, 50).trim()
    );

    console.log('✅ Generated title:', result.title, '(method:', result.method + ')');

    // Update conversation title in database
    const conversationsCollection = await getCollection("conversations");
    await conversationsCollection.updateOne(
      { _id: conversationId },
      { 
        $set: { 
          title: result.title,
          title_generated_at: new Date(),
          title_method: result.method
        } 
      }
    );

    console.log('✅ Updated conversation title in database');

    res.json({
      success: true,
      title: result.title,
      method: result.method
    });

  } catch (error) {
    console.error('❌ Error generating conversation title:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      // Return fallback title if available
      title: req.body.fallbackTitle || 'Untitled Conversation'
    });
  }
});

export default router;
