# Noeron: UX Flow Diagram

## System State Flow

```mermaid
stateDiagram-v2
    [*] --> PodcastPlaying
    
    state "Screen 1: Podcast + Feed" as Screen1 {
        PodcastPlaying --> PodcastPaused: User taps chat input
        PodcastPlaying --> PodcastPaused: User manually pauses
        PodcastPlaying --> PodcastPaused: User taps "Dive Deeper"
        PodcastPlaying --> PodcastPlaying: Feed updates (timestamp sync)
        
        PodcastPaused --> ChatActive: User types message
        PodcastPaused --> Exploration: User taps "Dive Deeper"
        PodcastPaused --> PodcastPlaying: User resumes playback
        
        ChatActive --> PodcastPaused: Chat response received
        ChatActive --> Exploration: "Dive Deeper" from chat response
    }
    
    state "Screen 2: Deep Exploration" as Screen2 {
        Exploration --> ExplorationELI5: Default entry
        
        ExplorationELI5 --> ExplorationTechnical: User taps "More Technical"
        ExplorationELI5 --> ConceptCardView: User taps concept card
        ExplorationELI5 --> EvidenceThreadView: User taps evidence thread
        ExplorationELI5 --> GuidedPromptResponse: User taps guided prompt
        
        ExplorationTechnical --> ExplorationData: User taps "Show Me The Data"
        ExplorationTechnical --> ConceptCardView: User taps concept card
        ExplorationTechnical --> EvidenceThreadView: User taps evidence thread
        
        ExplorationData --> PaperViewer: User taps "View Source Paper"
        ExplorationData --> ConceptCardView: User taps concept card
        
        ConceptCardView --> ExplorationELI5: New exploration context
        ConceptCardView --> Exploration: Back navigation
        
        EvidenceThreadView --> ExplorationELI5: New exploration context
        EvidenceThreadView --> Exploration: Back navigation
        
        GuidedPromptResponse --> ExplorationELI5: Prompts new exploration
        GuidedPromptResponse --> Exploration: Continue current exploration
    }
    
    state "Screen 3: Paper Viewer" as Screen3 {
        PaperViewer --> Exploration: Back to exploration
    }
    
    Exploration --> PodcastPaused: "Back to Podcast"
    PaperViewer --> PodcastPaused: "Back to Podcast" (via exploration)
    ConceptCardView --> PodcastPaused: "Back to Podcast"
    EvidenceThreadView --> PodcastPaused: "Back to Podcast"
    
    PodcastPaused --> PodcastPlaying: Auto-resume on return
    
    note right of Screen1
        Feed continuously syncs
        with podcast timestamp.
        Scrubbing updates feed.
    end note
    
    note right of Screen2
        All exploration state
        is tracked and preserved.
        Breadcrumbs enable navigation.
    end note
    
    note right of Screen3
        Primary sources available
        but not emphasized.
        Always clear path back.
    end note
```

## User Journey Flow

```mermaid
flowchart TD
    Start([User Opens App]) --> LoadEpisode[Load Podcast Episode]
    LoadEpisode --> PlayPodcast[Start Playing Podcast]
    
    PlayPodcast --> FeedBuilds{Feed Building}
    FeedBuilds -->|Timestamp reached| ShowInsight[Display New Insight Card]
    ShowInsight --> FeedBuilds
    
    FeedBuilds -->|User listening| ContinuePlay[Continue Playback]
    ContinuePlay --> FeedBuilds
    
    FeedBuilds -->|User curious| UserAction{User Action?}
    
    UserAction -->|Scrubs backward| RewindFeed[Filter Feed to Current Time]
    RewindFeed --> FeedBuilds
    
    UserAction -->|Scrubs forward| FastForwardFeed[Show Future Insights]
    FastForwardFeed --> FeedBuilds
    
    UserAction -->|Taps chat| PausePodcast1[Pause Podcast]
    PausePodcast1 --> OpenChat[Open Chat Interface]
    OpenChat --> TypeQuestion[User Types Question]
    TypeQuestion --> GeminiChat[Gemini Responds]
    GeminiChat --> ChatDecision{What Next?}
    ChatDecision -->|Satisfied| ResumePodcast1[Resume Podcast]
    ChatDecision -->|Wants more| OfferDive[Show "Dive Deeper" Option]
    OfferDive --> EnterExploration
    
    UserAction -->|Taps "Dive Deeper"| PausePodcast2[Pause Podcast]
    PausePodcast2 --> EnterExploration[Transition to Exploration Screen]
    
    EnterExploration --> ShowAnchor[Display Anchor Claim]
    ShowAnchor --> DefaultDepth[Show ELI5 Synthesis]
    
    DefaultDepth --> ExploreOptions{User Explores}
    
    ExploreOptions -->|More Technical| LoadTechnical[Load Technical Level]
    LoadTechnical --> ExploreOptions
    
    ExploreOptions -->|Show Data| LoadData[Load Data Level]
    LoadData --> ExploreOptions
    
    ExploreOptions -->|Concept Card| ExpandCard[Open Concept Card]
    ExpandCard --> CardDecision{Dive into Concept?}
    CardDecision -->|Yes| NewExploration[Start New Exploration Context]
    NewExploration --> ShowAnchor
    CardDecision -->|No| ExploreOptions
    
    ExploreOptions -->|Evidence Thread| FollowThread[Navigate Evidence Thread]
    FollowThread --> ThreadDecision{Continue Thread?}
    ThreadDecision -->|Yes| NewExploration
    ThreadDecision -->|No| ExploreOptions
    
    ExploreOptions -->|Guided Prompt| PromptResponse[Gemini Responds to Prompt]
    PromptResponse --> PromptDecision{Explore Further?}
    PromptDecision -->|Yes| NewExploration
    PromptDecision -->|No| ExploreOptions
    
    ExploreOptions -->|View Paper| OpenPaper[Open Paper Viewer]
    OpenPaper --> ReadPaper[User Reads Source]
    ReadPaper --> PaperDone{Done Reading?}
    PaperDone -->|Back| ExploreOptions
    
    ExploreOptions -->|Back to Podcast| TrackExploration[Mark Insight as Explored]
    TrackExploration --> ReturnToFeed[Return to Screen 1]
    ReturnToFeed --> ResumePodcast2[Resume from Saved Position]
    ResumePodcast2 --> FeedBuilds
    
    ResumePodcast1 --> FeedBuilds
    
    FeedBuilds -->|Episode ends| EpisodeComplete[Show Episode Complete]
    EpisodeComplete --> OfferNext[Suggest Related Episodes]
    OfferNext --> End([End Session])
    
    style Start fill:#e1f5ff
    style End fill:#ffe1e1
    style EnterExploration fill:#fff9e1
    style TrackExploration fill:#e1ffe1
    style PausePodcast1 fill:#ffe1f5
    style PausePodcast2 fill:#ffe1f5
```

## Detailed Interaction Flow: Dive Deeper

```mermaid
sequenceDiagram
    participant U as User
    participant P as Podcast Player
    participant F as Feed
    participant E as Exploration View
    participant G as Gemini API
    participant R as RAG Pipeline
    
    Note over U,R: User listening to podcast
    
    P->>F: Update timestamp (12:15)
    F->>F: Check for new insights
    F->>U: Display insight card
    
    U->>F: Tap "Dive Deeper"
    F->>P: Send pause command
    P->>P: Pause at 12:15
    
    F->>E: Transition with insight data
    E->>U: Show exploration screen
    E->>U: Display anchor claim
    
    E->>G: Request ELI5 synthesis
    G->>R: Query RAG for relevant papers
    R->>G: Return paper chunks
    G->>E: Return ELI5 synthesis
    E->>U: Display synthesis
    
    U->>E: Tap "More Technical"
    E->>G: Request technical level
    G->>R: Query with increased depth
    R->>G: Return detailed chunks
    G->>E: Return technical synthesis
    E->>U: Update display
    
    U->>E: Tap concept card "Key Experiments"
    E->>G: Request experiment details
    G->>R: Query for experimental data
    R->>G: Return experiment papers
    G->>E: Return structured experiment info
    E->>U: Display concept card expanded
    
    U->>E: Tap "Back to Podcast"
    E->>F: Track exploration (depth=2, cards=[experiments])
    F->>U: Return to feed view
    F->>P: Send resume command
    P->>P: Resume from 12:15
    
    Note over U,R: User continues listening with new understanding
```

## State Transition Matrix

```mermaid
graph LR
    subgraph "Layer 1: Passive"
        A[Playing] -->|User taps chat| B[Paused - Chat Ready]
        A -->|User taps Dive| C[Paused - Explore Ready]
        A -->|User pauses| D[Paused]
    end
    
    subgraph "Layer 2: Active"
        B -->|User types| E[Chatting]
        E -->|Response arrives| B
        E -->|Dive Deeper| F[Exploration]
        B -->|Resume| A
    end
    
    subgraph "Layer 3: Curated"
        C -->|Load exploration| F
        F -->|Change depth| F
        F -->|Open card| G[Card View]
        F -->|Follow thread| H[Thread View]
        F -->|Tap prompt| I[Prompt Response]
        G -->|New context| F
        H -->|New context| F
        I -->|New context| F
    end
    
    subgraph "Layer 4: Sources"
        F -->|View paper| J[Paper Viewer]
        J -->|Back| F
    end
    
    F -->|Back to Podcast| D
    G -->|Back to Podcast| D
    H -->|Back to Podcast| D
    D -->|Auto-resume| A
    
    style A fill:#90EE90
    style F fill:#FFD700
    style J fill:#87CEEB
```

## Timestamp Synchronization Logic

```mermaid
flowchart TD
    Start([Podcast Playback]) --> CheckTime{Every 100ms}
    
    CheckTime --> GetCurrentTime[Get Current Timestamp]
    GetCurrentTime --> QueryInsights[Query Insights for Current Time]
    
    QueryInsights --> FilterInsights{Filter Logic}
    
    FilterInsights -->|timestamp <= current| ShowInsight[Show in Feed]
    FilterInsights -->|timestamp > current| HideInsight[Hide/Gray Out]
    
    ShowInsight --> CheckExplored{Explored?}
    CheckExplored -->|Yes| MarkExplored[Show ✓ indicator]
    CheckExplored -->|No| MarkUnexplored[Normal state]
    
    MarkExplored --> CheckTime
    MarkUnexplored --> CheckTime
    HideInsight --> CheckTime
    
    CheckTime -->|User scrubs| HandleScrub[Update Display]
    HandleScrub --> GetCurrentTime
    
    style ShowInsight fill:#90EE90
    style HideInsight fill:#FFE4B5
    style MarkExplored fill:#87CEEB
```

## Exploration Depth Navigation

```mermaid
graph TD
    Entry[Enter Exploration] --> L1[Level 1: ELI5]
    
    L1 -->|More Technical| L2[Level 2: Technical]
    L1 -->|Jump to Data| L3[Level 3: Data]
    L1 -->|Jump to Paper| L4[Level 4: Source]
    
    L2 -->|Show Data| L3
    L2 -->|Jump to Paper| L4
    L2 -->|Simplify| L1
    
    L3 -->|View Paper| L4
    L3 -->|Back to Technical| L2
    L3 -->|Back to ELI5| L1
    
    L4 -->|Back| L3
    
    L1 -.->|Concept Card| NewContext1[New Exploration Context]
    L2 -.->|Concept Card| NewContext2[New Exploration Context]
    L3 -.->|Concept Card| NewContext3[New Exploration Context]
    
    NewContext1 --> L1
    NewContext2 --> L1
    NewContext3 --> L1
    
    L1 -->|Evidence Thread| Thread1[Follow Thread]
    L2 -->|Evidence Thread| Thread2[Follow Thread]
    
    Thread1 --> ThreadTarget1[Thread Destination]
    Thread2 --> ThreadTarget2[Thread Destination]
    
    ThreadTarget1 --> L1
    ThreadTarget2 --> L1
    
    style L1 fill:#90EE90
    style L2 fill:#FFD700
    style L3 fill:#FFA500
    style L4 fill:#FF6347
```

## Data Flow Architecture

```mermaid
flowchart TB
    subgraph "Pre-processing (Before Demo)"
        PT[Podcast Transcript] --> SA[Semantic Analysis]
        SA --> GI[Generate Insights]
        GI --> SI[Store Insights JSON]
    end
    
    subgraph "Runtime (During Demo)"
        User[User Action] --> UI[UI Layer]
        
        UI -->|Load episode| ES[Episode Service]
        ES --> SI
        SI -->|Feed data| UI
        
        UI -->|Timestamp update| TS[Timestamp Sync]
        TS -->|Filter insights| UI
        
        UI -->|Dive deeper| EX[Exploration Service]
        EX -->|Query context| RAG[RAG Pipeline]
        RAG -->|Paper chunks| GEM[Gemini API]
        GEM -->|Synthesis| EX
        EX -->|Render content| UI
        
        UI -->|Track exploration| TR[Tracking Service]
        TR -->|Update state| DB[(Session DB)]
        DB -->|Read state| UI
        
        UI -->|View paper| PS[Paper Service]
        PS -->|Fetch GROBID| PD[(Paper Data)]
        PD -->|Formatted| PS
        PS -->|Render| UI
    end
    
    style GI fill:#FFD700
    style GEM fill:#87CEEB
    style RAG fill:#90EE90
```

## Error Handling Flow

```mermaid
flowchart TD
    Action[User Action] --> Try{Try Operation}
    
    Try -->|Success| Success[Display Result]
    Success --> End([Continue])
    
    Try -->|Network Error| NetError[Show "Connection Issue"]
    NetError --> Retry{Retry?}
    Retry -->|Yes| Try
    Retry -->|No| Fallback1[Show Cached Content]
    Fallback1 --> End
    
    Try -->|API Timeout| Timeout[Show "Taking Longer Than Expected"]
    Timeout --> Wait[Wait with Progress]
    Wait --> Try
    
    Try -->|Rate Limit| RateLimit[Show "Please Wait"]
    RateLimit --> Backoff[Exponential Backoff]
    Backoff --> Try
    
    Try -->|No Results| NoResults[Show "No Relevant Papers Found"]
    NoResults --> Suggest[Suggest Alternative Queries]
    Suggest --> End
    
    Try -->|Critical Error| Critical[Log Error]
    Critical --> Fallback2[Show Graceful Degradation]
    Fallback2 --> End
    
    style Success fill:#90EE90
    style NetError fill:#FFB6C1
    style Critical fill:#FF6347
```

---

## Key Decision Points

### When to Pause Podcast

```mermaid
flowchart LR
    A[User Action] --> B{What action?}
    
    B -->|Tap chat input| C[PAUSE]
    B -->|Start typing| C
    B -->|Tap Dive Deeper| C
    B -->|Tap pause button| C
    
    B -->|Scrub timeline| D[DON'T PAUSE]
    B -->|Tap explored insight| D
    B -->|Scroll feed| D
    
    C --> E[Save exact timestamp]
    E --> F[Enable resume from saved point]
    
    style C fill:#FFB6C1
    style D fill:#90EE90
```

### When to Generate vs Retrieve Content

```mermaid
flowchart TD
    Request[Content Request] --> Check{Check Cache}
    
    Check -->|Found| Return[Return Cached]
    Check -->|Not Found| Type{Content Type?}
    
    Type -->|Feed Insight| PreGen[Use Pre-generated]
    PreGen --> Return
    
    Type -->|ELI5 Synthesis| Common{Common path?}
    Common -->|Yes| PreGen
    Common -->|No| Generate[Generate with Gemini]
    
    Type -->|Technical/Data| Generate
    Type -->|Chat Response| Generate
    Type -->|Concept Card| Generate
    
    Generate --> RAG[Query RAG]
    RAG --> Gemini[Gemini Synthesis]
    Gemini --> Cache[Cache Result]
    Cache --> Return
    
    Return --> End([Display to User])
    
    style PreGen fill:#90EE90
    style Generate fill:#FFD700
```

---

**End of Flow Diagram Documentation**