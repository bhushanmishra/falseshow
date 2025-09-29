// Test script to verify room creation works

async function testRoomCreation() {
    console.log('=== Testing Room Creation ===');

    // Test 1: Room code generation
    const generateRoomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    };

    const testCode = generateRoomCode();
    console.log('✓ Generated room code:', testCode);

    // Test 2: Load Trystero
    try {
        console.log('Loading Trystero...');
        const {joinRoom} = await import('https://esm.run/trystero/nostr');

        if (joinRoom) {
            console.log('✓ Trystero loaded successfully');

            // Test 3: Create a test room
            const config = {
                appId: 'false-show-test',
                password: testCode
            };

            const room = joinRoom(config);
            console.log('✓ Room created with config:', config);

            // Test 4: Check room methods
            console.log('Available room methods:', Object.keys(room));

            // Test 5: Set up a test action
            const [send, receive] = room.makeAction('test');
            console.log('✓ Created test action channel');

            // Test 6: Listen for peers
            room.onPeerJoin(peerId => {
                console.log('✓ Peer joined:', peerId);
            });

            room.onPeerLeave(peerId => {
                console.log('Peer left:', peerId);
            });

            console.log('=== All tests passed! ===');
            console.log('Room is ready with code:', testCode);

            // Return room for further testing
            return {room, code: testCode};
        }
    } catch (error) {
        console.error('✗ Error during test:', error);
    }
}

// Run test if this is loaded directly
if (typeof window !== 'undefined') {
    window.testRoomCreation = testRoomCreation;
    console.log('Test script loaded. Run testRoomCreation() to test.');
}