module.exports = function (router) {
    const User = require('../models/user');
    const Task = require('../models/task');
  
    const usersRoute = router.route('/users');
    const usersIdRoute = router.route('/users/:id');
  
    // GET /api/users
    usersRoute.get(async function (req, res) {
        try {
            const query = User.find(JSON.parse(req.query.where || '{}'));
            if (req.query.sort) query.sort(JSON.parse(req.query.sort));
            if (req.query.select) query.select(JSON.parse(req.query.select));
            if (req.query.skip) query.skip(parseInt(req.query.skip));
            if (req.query.limit) query.limit(parseInt(req.query.limit));
            const result = await query.exec();
    
            if (req.query.count === 'true') {
                res.status(200).json({ message: 'OK', data: result.length });
            } else {
                res.status(200).json({ message: 'OK', data: result });
            }
        } catch (err) {
            res.status(400).json({ message: 'Bad Request', data: err });
        }
    });
  
    // POST /api/users
    usersRoute.post(async function (req, res) {
        try {
            if (!req.body.name || !req.body.email)
                return res
                    .status(400)
                    .json({ message: 'Missing name or email', data: {} });
    
            const existing = await User.findOne({ email: req.body.email });
            if (existing)
                return res
                    .status(400)
                    .json({ message: 'Email already exists', data: {} });
    
            const newUser = new User(req.body);
            await newUser.save();
            res.status(201).json({ message: 'User created', data: newUser });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: err });
        }
    });
  
    // GET /api/users/:id
    usersIdRoute.get(async function (req, res) {
        try {
            const user = await User.findById(req.params.id);
            if (!user)
                return res.status(404).json({ message: 'User not found', data: {} });
            res.status(200).json({ message: 'OK', data: user });
        } catch (err) {
            res.status(400).json({ message: 'Bad Request', data: err });
        }
    });
  
    // PUT /api/users/:id
    usersIdRoute.put(async function (req, res) {
        try {
            const user = await User.findById(req.params.id);
            if (!user)
                return res.status(404).json({ message: 'User not found', data: {} });
    
            const updated = await User.findByIdAndUpdate(req.params.id, req.body, {
                new: true,
            });
    
            // Sync tasks to match updated pendingTasks
            const allTasks = await Task.find({ assignedUser: req.params.id });
    
            // Unassign tasks no longer in pendingTasks
            for (const task of allTasks) {
                if (!updated.pendingTasks.includes(task._id.toString())) {
                    task.assignedUser = '';
                    task.assignedUserName = 'unassigned';
                    await task.save();
                }
            }
    
            // Assign new tasks
            for (const taskId of updated.pendingTasks) {
                const task = await Task.findById(taskId);
                if (task) {
                    task.assignedUser = updated._id.toString();
                    task.assignedUserName = updated.name;
                    await task.save();
                }
            }
    
            res.status(200).json({ message: 'User updated', data: updated });
        } catch (err) {
            res.status(400).json({ message: 'Bad Request', data: err });
        }
    });
  
    // DELETE /api/users/:id
    usersIdRoute.delete(async function (req, res) {
        try {
            const deleted = await User.findByIdAndDelete(req.params.id);
            if (!deleted)
                return res.status(404).json({ message: 'User not found', data: {} });
    
            // Unassign all tasks for this user
            await Task.updateMany(
                { assignedUser: deleted._id.toString() },
                { $set: { assignedUser: '', assignedUserName: 'unassigned' } }
            );
    
            res.status(200).json({ message: 'User deleted', data: deleted });
        } catch (err) {
            res.status(400).json({ message: 'Bad Request', data: err });
        }
    });
  
    return router;
};
  