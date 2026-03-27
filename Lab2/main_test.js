const test = require('node:test');
const assert = require('assert');
const fs = require('fs');

// Stub fs.readFile before requiring main.js,
// because main.js binds promisified readFile at load time.
const originalReadFile = fs.readFile;
fs.readFile = (path, encoding, callback) => {
    callback(null, 'Alice\nBob\nCharlie');
};

const { Application, MailSystem } = require('./main');

test.after(() => {
    fs.readFile = originalReadFile;
});

test('MailSystem.write returns correct content', (t) => {
    t.mock.method(console, 'log', () => {});
    const mailSystem = new MailSystem();

    const result = mailSystem.write('Alice');

    assert.strictEqual(result, 'Congrats, Alice!');
});

test('MailSystem.send returns true when random > 0.5', (t) => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(Math, 'random', () => 0.9);

    const mailSystem = new MailSystem();
    const result = mailSystem.send('Alice', 'Congrats, Alice!');

    assert.strictEqual(result, true);
});

test('MailSystem.send returns false when random <= 0.5', (t) => {
    t.mock.method(console, 'log', () => {});
    t.mock.method(Math, 'random', () => 0.1);

    const mailSystem = new MailSystem();
    const result = mailSystem.send('Bob', 'Congrats, Bob!');

    assert.strictEqual(result, false);
});

test('Application.getNames returns people and empty selected list', async () => {
    const app = new Application();
    const [people, selected] = await app.getNames();

    assert.deepStrictEqual(people, ['Alice', 'Bob', 'Charlie']);
    assert.deepStrictEqual(selected, []);
});

test('Application constructor initializes people and selected asynchronously', async () => {
    const app = new Application();

    await new Promise((resolve) => setImmediate(resolve));

    assert.deepStrictEqual(app.people, ['Alice', 'Bob', 'Charlie']);
    assert.deepStrictEqual(app.selected, []);
});

test('Application.getRandomPerson returns expected person', (t) => {
    const app = new Application();
    app.people = ['Alice', 'Bob', 'Charlie'];

    t.mock.method(Math, 'random', () => 0.4); // floor(0.4 * 3) = 1

    const result = app.getRandomPerson();

    assert.strictEqual(result, 'Bob');
});

test('Application.selectNextPerson returns null when all people are selected', (t) => {
    t.mock.method(console, 'log', () => {});
    const app = new Application();
    app.people = ['Alice', 'Bob'];
    app.selected = ['Alice', 'Bob'];

    const result = app.selectNextPerson();

    assert.strictEqual(result, null);
    assert.deepStrictEqual(app.selected, ['Alice', 'Bob']);
});

test('Application.selectNextPerson selects a new person directly', (t) => {
    t.mock.method(console, 'log', () => {});
    const app = new Application();
    app.people = ['Alice', 'Bob'];
    app.selected = [];

    t.mock.method(app, 'getRandomPerson', () => 'Alice');

    const result = app.selectNextPerson();

    assert.strictEqual(result, 'Alice');
    assert.deepStrictEqual(app.selected, ['Alice']);
});

test('Application.selectNextPerson retries when duplicate person is chosen', (t) => {
    t.mock.method(console, 'log', () => {});
    const app = new Application();
    app.people = ['Alice', 'Bob'];
    app.selected = ['Alice'];

    let count = 0;
    t.mock.method(app, 'getRandomPerson', () => {
        count += 1;
        return count === 1 ? 'Alice' : 'Bob';
    });

    const result = app.selectNextPerson();

    assert.strictEqual(result, 'Bob');
    assert.deepStrictEqual(app.selected, ['Alice', 'Bob']);
});

test('Application.notifySelected calls write and send for each selected person', (t) => {
    t.mock.method(console, 'log', () => {});
    const app = new Application();
    app.selected = ['Alice', 'Bob'];

    const writeMock = t.mock.method(app.mailSystem, 'write', (name) => `Congrats, ${name}!`);
    const sendMock = t.mock.method(app.mailSystem, 'send', () => true);

    app.notifySelected();

    assert.strictEqual(writeMock.mock.calls.length, 2);
    assert.strictEqual(sendMock.mock.calls.length, 2);

    assert.deepStrictEqual(writeMock.mock.calls[0].arguments, ['Alice']);
    assert.deepStrictEqual(writeMock.mock.calls[1].arguments, ['Bob']);

    assert.deepStrictEqual(sendMock.mock.calls[0].arguments, ['Alice', 'Congrats, Alice!']);
    assert.deepStrictEqual(sendMock.mock.calls[1].arguments, ['Bob', 'Congrats, Bob!']);
});
