#include "AudioAcceptanceActor.h"
#include "AudioMixerBlueprintLibrary.h"
#include "Components/AudioComponent.h"
#include "Sound/SoundWaveProcedural.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/PlatformMisc.h"

AAudioAcceptanceActor::AAudioAcceptanceActor() { PrimaryActorTick.bCanEverTick=true; }
void AAudioAcceptanceActor::BeginPlay() {
    Super::BeginPlay();
    auto* Wave=NewObject<USoundWaveProcedural>(this); Wave->SetSampleRate(48000); Wave->NumChannels=1; Wave->Duration=20;
    TArray<int16> Samples; Samples.SetNumUninitialized(48000*20);
    for(int32 Index=0;Index<Samples.Num();Index++) Samples[Index]=static_cast<int16>(FMath::Sin(2*PI*440*Index/48000.0)*16000);
    Wave->QueueAudio(reinterpret_cast<const uint8*>(Samples.GetData()),Samples.Num()*sizeof(int16));
    Source=NewObject<UAudioComponent>(this); Source->bAutoActivate=false; Source->bIsUISound=true;
    Source->SetSound(Wave); Source->SetVolumeMultiplier(0.2f); Source->RegisterComponent(); Source->Play();
    Deadline=FPlatformTime::Seconds()+1;
}
void AAudioAcceptanceActor::Record() { UAudioMixerBlueprintLibrary::StartRecordingOutput(this,3); }
void AAudioAcceptanceActor::Export(const FString& Name) {
    UAudioMixerBlueprintLibrary::StopRecordingOutput(this,EAudioRecordingExportType::WavFile,Name,FPaths::ProjectSavedDir()/TEXT("AudioAcceptance"));
}
void AAudioAcceptanceActor::Tick(float DeltaSeconds) {
    Super::Tick(DeltaSeconds); if(FPlatformTime::Seconds()<Deadline) return;
    switch(Phase++) {
        case 0: Record(); Deadline=FPlatformTime::Seconds()+2; break;
        case 1: Export(TEXT("playing")); Source->SetPaused(true); Deadline=FPlatformTime::Seconds()+0.5; break;
        case 2: Record(); Deadline=FPlatformTime::Seconds()+1; break;
        case 3: Export(TEXT("paused")); Source->SetPaused(false); Deadline=FPlatformTime::Seconds()+0.5; break;
        case 4: Record(); Deadline=FPlatformTime::Seconds()+2; break;
        case 5: Export(TEXT("resumed")); Deadline=FPlatformTime::Seconds()+1; break;
        default:
            FFileHelper::SaveStringToFile(TEXT("{\"collectionComplete\":true,\"assertionsExternal\":true}"),*(FPaths::ProjectSavedDir()/TEXT("AudioAcceptance/collection.json")));
            FPlatformMisc::RequestExitWithStatus(false,0); break;
    }
}
